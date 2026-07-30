const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const IntegrationLabScenario = require("../models/IntegrationLabScenario");
const IntegrationLabAttempt = require("../models/IntegrationLabAttempt");

const AUTH_MODES = ["basic", "bearer", "api-key", "oauth2", "hmac"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const DEFAULT_TTL_HOURS = 168;

function isLabEnabled() {
  return String(process.env.INTEGRATION_LAB_ENABLED || "").toLowerCase() === "true";
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function matchesConfiguredSecret(candidate, configured) {
  return Boolean(String(configured || "")) && safeEqual(candidate, configured);
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getExpiry(hours = DEFAULT_TTL_HOURS) {
  const numericHours = Number(hours);
  const safeHours = Number.isFinite(numericHours)
    ? Math.min(Math.max(numericHours, 1), 720)
    : DEFAULT_TTL_HOURS;
  return new Date(Date.now() + safeHours * 60 * 60 * 1000);
}

function parseBasicAuthorization(header = "") {
  if (!header.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function createOAuthToken() {
  const secret = process.env.INTEGRATION_LAB_OAUTH_JWT_SECRET;
  if (!secret) throw new Error("INTEGRATION_LAB_OAUTH_JWT_SECRET no configurado");
  return jwt.sign(
    { scope: "integration-lab", token_use: "access" },
    secret,
    {
      subject: "salesforce-integration-lab",
      audience: "vitra-integration-lab",
      issuer: "vitra",
      expiresIn: "10m",
    }
  );
}

function verifyOAuthToken(token) {
  const secret = process.env.INTEGRATION_LAB_OAUTH_JWT_SECRET;
  if (!secret) return false;
  try {
    jwt.verify(token, secret, {
      audience: "vitra-integration-lab",
      issuer: "vitra",
      subject: "salesforce-integration-lab",
    });
    return true;
  } catch {
    return false;
  }
}

function verifyHmac({ timestamp, signature, method, path, body }) {
  const secret = process.env.INTEGRATION_LAB_HMAC_SECRET;
  if (!secret || !timestamp || !signature) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  const ageSeconds = Math.abs(Date.now() - timestampNumber) / 1000;
  if (ageSeconds > 300) return false;

  const canonical = [
    timestamp,
    String(method || "").toUpperCase(),
    path,
    JSON.stringify(body ?? null),
  ].join(".");
  const expected = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  return safeEqual(signature.replace(/^sha256=/, ""), expected);
}

function authenticateRequest(req, mode) {
  if (!AUTH_MODES.includes(mode)) {
    return { ok: false, status: 400, message: "Modo de autenticacion no soportado" };
  }

  const authorization = req.headers.authorization || "";
  if (mode === "basic") {
    const credentials = parseBasicAuthorization(authorization);
    const ok =
      credentials &&
      matchesConfiguredSecret(credentials.username, process.env.INTEGRATION_LAB_BASIC_USER) &&
      matchesConfiguredSecret(credentials.password, process.env.INTEGRATION_LAB_BASIC_PASSWORD);
    return ok
      ? { ok: true }
      : { ok: false, status: 401, message: "Credenciales Basic invalidas" };
  }

  if (mode === "bearer") {
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    return matchesConfiguredSecret(token, process.env.INTEGRATION_LAB_BEARER_TOKEN)
      ? { ok: true }
      : { ok: false, status: 401, message: "Bearer token invalido" };
  }

  if (mode === "api-key") {
    return matchesConfiguredSecret(req.headers["x-api-key"], process.env.INTEGRATION_LAB_API_KEY)
      ? { ok: true }
      : { ok: false, status: 401, message: "API key invalida" };
  }

  if (mode === "oauth2") {
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    return verifyOAuthToken(token)
      ? { ok: true }
      : { ok: false, status: 401, message: "OAuth access token invalido o expirado" };
  }

  const ok = verifyHmac({
    timestamp: req.headers["x-timestamp"],
    signature: req.headers["x-signature"],
    method: req.method,
    path: req.originalUrl.split("?")[0],
    body: req.body,
  });
  return ok
    ? { ok: true }
    : { ok: false, status: 401, message: "Firma HMAC invalida o expirada" };
}

function sanitizeHeaders(headers = {}) {
  const allowed = [
    "content-type",
    "user-agent",
    "x-request-id",
    "x-correlation-id",
    "x-timestamp",
  ];
  return Object.fromEntries(
    allowed.filter((key) => headers[key] !== undefined).map((key) => [key, headers[key]])
  );
}

async function executeScenario({ scenarioKey, authMode, req }) {
  const scenario = await IntegrationLabScenario.findOneAndUpdate(
    { key: scenarioKey, enabled: true, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  ).lean();

  if (!scenario) {
    const error = new Error("Escenario no encontrado, deshabilitado o expirado");
    error.statusCode = 404;
    throw error;
  }

  if (!scenario.acceptedMethods.includes(req.method)) {
    const error = new Error(`Metodo ${req.method} no permitido para este escenario`);
    error.statusCode = 405;
    throw error;
  }

  const shouldFail = scenario.attempts <= scenario.failFirst;
  const responseStatus = shouldFail ? scenario.failureStatus : scenario.successStatus;
  const requestId =
    String(req.headers["x-request-id"] || req.headers["x-correlation-id"] || "").trim() ||
    crypto.randomUUID();

  await IntegrationLabAttempt.create({
    requestId,
    scenarioKey,
    attemptNumber: scenario.attempts,
    method: req.method,
    authMode,
    responseStatus,
    query: req.query || {},
    body: req.body ?? null,
    headers: sanitizeHeaders(req.headers),
    expiresAt: scenario.expiresAt,
  });

  return {
    status: responseStatus,
    body: responseStatus === 204
      ? null
      : {
          ok: !shouldFail,
          intentionalFailure: shouldFail,
          scenario: scenario.key,
          requestId,
          attempt: scenario.attempts,
          failFirst: scenario.failFirst,
          received: {
            method: req.method,
            query: req.query || {},
            body: req.body ?? null,
          },
          ...(shouldFail
            ? { error: `Fallo intencional ${scenario.attempts}/${scenario.failFirst}` }
            : { result: scenario.responseBody || {} }),
        },
  };
}

module.exports = {
  AUTH_MODES,
  METHODS,
  authenticateRequest,
  createOAuthToken,
  executeScenario,
  getExpiry,
  isLabEnabled,
  normalizeKey,
  parseBasicAuthorization,
  matchesConfiguredSecret,
  safeEqual,
};

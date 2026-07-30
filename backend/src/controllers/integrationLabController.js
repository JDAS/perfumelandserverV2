const IntegrationLabScenario = require("../models/IntegrationLabScenario");
const IntegrationLabAttempt = require("../models/IntegrationLabAttempt");
const {
  AUTH_MODES,
  METHODS,
  authenticateRequest,
  createOAuthToken,
  executeScenario,
  getExpiry,
  isLabEnabled,
  matchesConfiguredSecret,
  normalizeKey,
  parseBasicAuthorization,
} = require("../services/integrationLabService");

function requireEnabled(req, res, next) {
  if (!isLabEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }
  return next();
}

function requireAdminKey(req, res, next) {
  if (
    !matchesConfiguredSecret(
      req.headers["x-lab-admin-key"],
      process.env.INTEGRATION_LAB_ADMIN_KEY
    )
  ) {
    return res.status(401).json({ error: "Lab admin key invalida" });
  }
  return next();
}

function authenticate(req, res, next) {
  const result = authenticateRequest(req, req.params.mode);
  if (!result.ok) return res.status(result.status).json({ error: result.message });
  return next();
}

async function health(req, res) {
  return res.json({
    ok: true,
    service: "vitra-integration-lab",
    temporary: true,
    authModes: AUTH_MODES,
    methods: METHODS,
    timestamp: new Date().toISOString(),
  });
}

async function issueToken(req, res) {
  const basic = parseBasicAuthorization(req.headers.authorization || "");
  const clientId = basic?.username || req.body?.client_id;
  const clientSecret = basic?.password || req.body?.client_secret;
  const grantType = req.body?.grant_type;

  if (grantType !== "client_credentials") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }
  if (
    !matchesConfiguredSecret(clientId, process.env.INTEGRATION_LAB_OAUTH_CLIENT_ID) ||
    !matchesConfiguredSecret(clientSecret, process.env.INTEGRATION_LAB_OAUTH_CLIENT_SECRET)
  ) {
    return res.status(401).json({ error: "invalid_client" });
  }

  return res.json({
    access_token: createOAuthToken(),
    token_type: "Bearer",
    expires_in: 600,
    scope: "integration-lab",
  });
}

async function upsertScenario(req, res) {
  const key = normalizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: "Scenario key invalido" });

  const acceptedMethods = (req.body?.acceptedMethods || METHODS)
    .map((method) => String(method).toUpperCase())
    .filter((method) => METHODS.includes(method));
  const payload = {
    key,
    description: String(req.body?.description || ""),
    enabled: req.body?.enabled !== false,
    acceptedMethods: acceptedMethods.length ? acceptedMethods : METHODS,
    failFirst: Number(req.body?.failFirst ?? 1),
    failureStatus: Number(req.body?.failureStatus ?? 503),
    successStatus: Number(req.body?.successStatus ?? 200),
    responseBody: req.body?.responseBody || {},
    expiresAt: getExpiry(req.body?.ttlHours),
  };

  const scenario = await IntegrationLabScenario.findOneAndUpdate(
    { key },
    { $set: payload, $setOnInsert: { attempts: 0 } },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();
  return res.json(scenario);
}

async function listScenarios(req, res) {
  const scenarios = await IntegrationLabScenario.find({ expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  return res.json(scenarios);
}

async function resetScenario(req, res) {
  const key = normalizeKey(req.params.key);
  const scenario = await IntegrationLabScenario.findOneAndUpdate(
    { key },
    { $set: { attempts: 0 } },
    { returnDocument: "after" }
  ).lean();
  if (!scenario) return res.status(404).json({ error: "Escenario no encontrado" });
  return res.json(scenario);
}

async function listAttempts(req, res) {
  const key = normalizeKey(req.params.key);
  const attempts = await IntegrationLabAttempt.find({ scenarioKey: key })
    .sort({ attemptNumber: -1 })
    .limit(100)
    .lean();
  return res.json(attempts);
}

async function exercise(req, res) {
  const result = await executeScenario({
    scenarioKey: normalizeKey(req.params.key),
    authMode: req.params.mode,
    req,
  });
  if (result.status === 204) return res.status(204).end();
  return res.status(result.status).json(result.body);
}

module.exports = {
  authenticate,
  exercise,
  health,
  issueToken,
  listAttempts,
  listScenarios,
  requireAdminKey,
  requireEnabled,
  resetScenario,
  upsertScenario,
};

const { createHttpError } = require("../utils/httpError");

const attemptStores = new Map();

const RATE_LIMITS = {
  login: {
    label: "inicio de sesion",
    buckets: [
      {
        type: "ip",
        windowMs: 10 * 60 * 1000,
        maxFailures: 20,
        lockoutMs: 20 * 60 * 1000,
      },
      {
        type: "identifier",
        windowMs: 10 * 60 * 1000,
        maxFailures: 8,
        lockoutMs: 15 * 60 * 1000,
      },
    ],
  },
  bootstrapAdmin: {
    label: "configuracion inicial",
    buckets: [
      {
        type: "ip",
        windowMs: 30 * 60 * 1000,
        maxFailures: 5,
        lockoutMs: 30 * 60 * 1000,
      },
    ],
  },
};

function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string" && forwardedFor.trim()
      ? forwardedFor.split(",")[0]
      : req.ip || req.socket?.remoteAddress || "unknown";

  return String(rawIp || "")
    .trim()
    .replace(/^::ffff:/, "") || "unknown";
}

function normalizeIdentifier(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getScopeConfig(scope) {
  const config = RATE_LIMITS[scope];

  if (!config) {
    throw new Error(`Rate limit scope no soportado: ${scope}`);
  }

  return config;
}

function getScopeStore(scope) {
  if (!attemptStores.has(scope)) {
    attemptStores.set(scope, new Map());
  }

  return attemptStores.get(scope);
}

function buildBucketKey(bucket, req, identifier) {
  const ip = getRequestIp(req);

  if (bucket.type === "identifier") {
    return identifier ? `identifier:${identifier}` : null;
  }

  return `ip:${ip}`;
}

function pruneRecord(record, now, bucket) {
  record.failures = (record.failures || []).filter(
    (timestamp) => now - timestamp <= bucket.windowMs
  );

  if (record.lockedUntil && record.lockedUntil <= now) {
    record.lockedUntil = 0;
  }

  return record;
}

function getBucketState(scope, key) {
  const scopeStore = getScopeStore(scope);
  return scopeStore.get(key) || { failures: [], lockedUntil: 0 };
}

function setBucketState(scope, key, state) {
  const scopeStore = getScopeStore(scope);

  if (!state.failures.length && !state.lockedUntil) {
    scopeStore.delete(key);
    return;
  }

  scopeStore.set(key, state);
}

function getBlockedError(config, retryAfterMs) {
  return createHttpError(
    429,
    `Demasiados intentos de ${config.label}. Espera unos minutos antes de volver a intentar.`,
    {
      details: {
        retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
      },
    }
  );
}

function getBucketEntries(scope, req, identifier = "") {
  const config = getScopeConfig(scope);
  const normalizedIdentifier = normalizeIdentifier(identifier);

  return config.buckets
    .map((bucket) => {
      const key = buildBucketKey(bucket, req, normalizedIdentifier);
      return key ? { bucket, key } : null;
    })
    .filter(Boolean);
}

function assertAuthActionAllowed(scope, req, identifier = "") {
  const config = getScopeConfig(scope);
  const now = Date.now();

  for (const entry of getBucketEntries(scope, req, identifier)) {
    const state = pruneRecord(getBucketState(scope, entry.key), now, entry.bucket);
    setBucketState(scope, entry.key, state);

    if (state.lockedUntil && state.lockedUntil > now) {
      throw getBlockedError(config, state.lockedUntil - now);
    }
  }
}

function recordAuthFailure(scope, req, identifier = "") {
  const now = Date.now();

  for (const entry of getBucketEntries(scope, req, identifier)) {
    const state = pruneRecord(getBucketState(scope, entry.key), now, entry.bucket);
    state.failures.push(now);

    if (state.failures.length >= entry.bucket.maxFailures) {
      state.failures = [];
      state.lockedUntil = now + entry.bucket.lockoutMs;
    }

    setBucketState(scope, entry.key, state);
  }
}

function clearAuthFailures(scope, req, identifier = "") {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  for (const entry of getBucketEntries(scope, req, normalizedIdentifier)) {
    if (entry.bucket.type !== "identifier") {
      continue;
    }

    setBucketState(scope, entry.key, { failures: [], lockedUntil: 0 });
  }
}

module.exports = {
  assertAuthActionAllowed,
  recordAuthFailure,
  clearAuthFailures,
};

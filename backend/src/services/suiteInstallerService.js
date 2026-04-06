const CustomObject = require("../models/CustomObject");
const {
  sanitizeObjectPayload,
  validateObjectMetadata,
} = require("../utils/objectMetadata");
const { getSuiteById, listSuites } = require("../data/suites");

async function upsertObjectDefinition(payload) {
  const sanitized = sanitizeObjectPayload(payload);
  const errors = validateObjectMetadata(sanitized);

  if (errors.length > 0) {
    const error = new Error(
      `Error en ${sanitized.apiName}: ${errors.join(" | ")}`
    );
    error.statusCode = 400;
    throw error;
  }

  const existing = await CustomObject.findOne({ apiName: sanitized.apiName });

  if (existing) {
    existing.set(sanitized);
    await existing.save();
    return { apiName: sanitized.apiName, action: "updated" };
  }

  await CustomObject.create(sanitized);
  return { apiName: sanitized.apiName, action: "created" };
}

async function installSuite(suiteId) {
  const suite = getSuiteById(suiteId);

  if (!suite) {
    const error = new Error("Suite no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const results = [];

  for (const objectDefinition of suite.objects) {
    // Keep installation deterministic for related metadata.
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertObjectDefinition(objectDefinition);
    results.push(result);
  }

  return {
    suite: {
      id: suite.id,
      name: suite.name,
      description: suite.description,
      objectCount: suite.objects.length,
    },
    results,
  };
}

module.exports = {
  listSuites,
  installSuite,
};

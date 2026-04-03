const CustomObject = require("../models/CustomObject");
const {
  sanitizeObjectPayload,
  validateObjectMetadata,
} = require("../utils/objectMetadata");

async function createObject(payload) {
  const sanitized = sanitizeObjectPayload(payload);
  const errors = validateObjectMetadata(sanitized);

  if (errors.length > 0) {
    const error = new Error(errors.join(" | "));
    error.statusCode = 400;
    throw error;
  }

  const existing = await CustomObject.findOne({ apiName: sanitized.apiName });
  if (existing) {
    const error = new Error(`Ya existe un objeto con apiName ${sanitized.apiName}`);
    error.statusCode = 409;
    throw error;
  }

  return CustomObject.create(sanitized);
}

async function updateObject(apiName, payload) {
  const existing = await CustomObject.findOne({ apiName });
  if (!existing) {
    const error = new Error("Objeto no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const sanitized = sanitizeObjectPayload(payload, existing);
  const errors = validateObjectMetadata(sanitized);

  if (errors.length > 0) {
    const error = new Error(errors.join(" | "));
    error.statusCode = 400;
    throw error;
  }

  existing.set(sanitized);
  await existing.save();
  return existing;
}

module.exports = {
  createObject,
  updateObject,
};

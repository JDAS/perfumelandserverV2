const getCustomRecordModel = require("../models/CustomRecord");
const CustomObject = require("../models/CustomObject");
const { removeFormulaFields } = require("../utils/formulaEngine");

function castFieldValue(field, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  switch (field.type) {
    case "number":
      return value === "" ? null : Number(value);
    case "boolean":
      if (typeof value === "boolean") return value;
      return value === "true" || value === "1" || value === 1;
    case "date":
      return value === "" ? null : new Date(value);
    default:
      return value;
  }
}

function sanitizeRecordPayload(payload = {}, objectDefinition) {
  const allowedFieldMap = new Map(
    (objectDefinition.fields || []).map((field) => [field.apiName, field])
  );

  // 👇 eliminar campos fórmula desde el inicio
  const payloadClean = removeFormulaFields(objectDefinition.fields, payload);

  const sanitized = {};
  const invalidFields = [];

  Object.entries(payloadClean || {}).forEach(([key, value]) => {
    if (!allowedFieldMap.has(key)) {
      invalidFields.push(key);
      return;
    }

    sanitized[key] = castFieldValue(allowedFieldMap.get(key), value);
  });

  return { sanitized, invalidFields };
}

function validateRecordPayload(payload = {}, objectDefinition, { partial = false } = {}) {
  const errors = [];

  for (const field of objectDefinition.fields || []) {
    const value = payload[field.apiName];

    if (!partial && field.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label} es requerido`);
    }

    if (partial && field.required && Object.prototype.hasOwnProperty.call(payload, field.apiName) && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label} es requerido`);
    }

    if (value !== undefined && value !== null && value !== "") {
      if (field.type === "number" && Number.isNaN(Number(value))) {
        errors.push(`${field.label} debe ser numérico`);
      }

      if (field.type === "select" && Array.isArray(field.options) && field.options.length > 0 && !field.options.includes(value)) {
        errors.push(`${field.label} debe ser una opción válida`);
      }
    }
  }

  return errors;
}

async function getObjectOrThrow(apiName) {
  const customObject = await CustomObject.findOne({ apiName });
  if (!customObject) {
    const error = new Error("Objeto no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return customObject;
}

function buildMongoQuery({ objectDefinition, search, filtersJson }) {
  const query = {};

  if (search) {
    const searchableFields = (objectDefinition.fields || []).filter((field) => ["text", "textarea", "email", "phone", "url", "select"].includes(field.type));
    if (searchableFields.length > 0) {
      query.$or = searchableFields.map((field) => ({
        [field.apiName]: { $regex: search, $options: "i" },
      }));
    }
  }

  if (filtersJson) {
    try {
      const filters = JSON.parse(filtersJson);
      if (Array.isArray(filters)) {
        for (const filter of filters) {
          if (!filter?.field || filter.value === undefined || filter.value === "") continue;
          query[filter.field] = filter.operator === "ne" ? { $ne: filter.value } : filter.value;
        }
      }
    } catch (error) {
      // ignore malformed filters to avoid hard failure in UI.
    }
  }

  return query;
}

async function listRecords(apiName, params = {}) {
  const objectDefinition = await getObjectOrThrow(apiName);
  const RecordModel = getCustomRecordModel(apiName);

  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const sortField = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder === "asc" ? 1 : -1;
  const query = buildMongoQuery({
    objectDefinition,
    search: params.search,
    filtersJson: params.filters,
  });

  const [records, total] = await Promise.all([
    RecordModel.find(query)
      .sort({ [sortField]: sortOrder, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    RecordModel.countDocuments(query),
  ]);

  const { applyFormulaFields } = require("../utils/formulaEngine");

  const processedRecords = records.map((doc) => {
    const plain = doc.toObject();
    return applyFormulaFields(objectDefinition.fields, plain);
  });

  return {
    records: processedRecords,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = {
  getObjectOrThrow,
  sanitizeRecordPayload,
  validateRecordPayload,
  listRecords,
};

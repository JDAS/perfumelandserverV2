const { getCustomRecordModel } = require('../models/CustomRecord');
const CustomObject = require('../models/CustomObject');

const READ_ONLY_FIELD_TYPES = new Set(['formula', 'rollup']);
const RESERVED_FIELDS = new Set(['_id', 'createdAt', 'updatedAt', '__v']);

function buildFieldMap(fields = []) {
  return new Map((fields || []).map((field) => [field.apiName, field]));
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function castFieldValue(field, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  switch (field?.type) {
    case 'number':
      return value === '' ? null : Number(value);
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
        if (['false', '0', 'no'].includes(normalized)) return false;
      }
      return Boolean(value);
    case 'date':
      return value === '' ? null : new Date(value);
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
    case 'select':
    case 'lookup':
      return typeof value === 'string' ? value.trim() : value;
    default:
      return value;
  }
}

async function validateRecordPayload(payload = {}, objectDefinition, { partial = false } = {}) {
  const fieldMap = buildFieldMap(objectDefinition?.fields || []);
  const sanitizedPayload = {};
  const errors = [];
  const invalidFields = [];
  const blockedFields = [];

  for (const [key, rawValue] of Object.entries(payload || {})) {
    if (RESERVED_FIELDS.has(key)) {
      blockedFields.push(key);
      continue;
    }

    const field = fieldMap.get(key);

    if (!field) {
      invalidFields.push(key);
      continue;
    }

    if (READ_ONLY_FIELD_TYPES.has(field.type)) {
      blockedFields.push(key);
      continue;
    }

    sanitizedPayload[key] = castFieldValue(field, rawValue);
  }

  for (const field of objectDefinition?.fields || []) {
    if (READ_ONLY_FIELD_TYPES.has(field.type)) continue;

    const hasOwnValue = Object.prototype.hasOwnProperty.call(sanitizedPayload, field.apiName);
    const value = sanitizedPayload[field.apiName];

    if (!partial && field.required && isBlank(value)) {
      errors.push(`${field.label} es requerido`);
      continue;
    }

    if (partial && field.required && hasOwnValue && isBlank(value)) {
      errors.push(`${field.label} es requerido`);
      continue;
    }

    if (!hasOwnValue || isBlank(value)) continue;

    if (field.type === 'number' && Number.isNaN(value)) {
      errors.push(`${field.label} debe ser numérico`);
    }

    if (field.type === 'date' && Number.isNaN(new Date(value).getTime())) {
      errors.push(`${field.label} debe ser una fecha válida`);
    }

    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        errors.push(`${field.label} debe ser un correo válido`);
      }
    }

    if (field.type === 'url') {
      try {
        new URL(String(value));
      } catch (error) {
        errors.push(`${field.label} debe ser una URL válida`);
      }
    }

    if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0 && !field.options.includes(value)) {
      errors.push(`${field.label} debe ser una opción válida`);
    }

    if (field.type === 'lookup') {
      if (!field.referenceTo) {
        errors.push(`${field.label} no tiene objeto de referencia configurado`);
        continue;
      }

      const referenceObject = await CustomObject.findOne({ apiName: field.referenceTo }).lean();
      if (!referenceObject) {
        errors.push(`${field.label} referencia un objeto inexistente (${field.referenceTo})`);
        continue;
      }

      const RelatedModel = getCustomRecordModel(field.referenceTo);
      const exists = await RelatedModel.exists({ _id: value });
      if (!exists) {
        errors.push(`${field.label} referencia un registro inexistente`);
      }
    }
  }

  return {
    sanitizedPayload,
    errors,
    invalidFields,
    blockedFields,
  };
}

module.exports = {
  READ_ONLY_FIELD_TYPES,
  RESERVED_FIELDS,
  buildFieldMap,
  castFieldValue,
  validateRecordPayload,
};

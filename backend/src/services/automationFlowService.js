const mongoose = require("mongoose");
const AutomationFlow = require("../models/AutomationFlow");
const CustomObject = require("../models/CustomObject");
const { createHttpError } = require("../utils/httpError");

const FLOW_EVENTS = [
  "beforeInsert",
  "afterInsert",
  "beforeUpdate",
  "afterUpdate",
  "beforeDelete",
  "afterDelete",
];

const CONDITION_OPERATOR_MAP = {
  eq: "eq",
  equals: "eq",
  ne: "ne",
  notEquals: "ne",
  gt: "gt",
  greaterThan: "gt",
  gte: "gte",
  greaterThanOrEqual: "gte",
  lt: "lt",
  lessThan: "lt",
  lte: "lte",
  lessThanOrEqual: "lte",
  contains: "contains",
  changed: "changed",
  isEmpty: "isEmpty",
  isNotEmpty: "isNotEmpty",
};

function normalizeObjectApiName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeApiName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fieldExists(objectDefinition, apiName) {
  return Boolean(
    (objectDefinition?.fields || []).find((field) => field.apiName === apiName)
  );
}

function getFieldDefinition(objectDefinition, apiName) {
  return (objectDefinition?.fields || []).find((field) => field.apiName === apiName);
}

function normalizeConditionNode(node) {
  if (!node) {
    return { operator: "AND", conditions: [] };
  }

  if (Array.isArray(node)) {
    return {
      operator: "AND",
      conditions: node.map(normalizeConditionNode),
    };
  }

  if (Array.isArray(node.conditions)) {
    return {
      operator: String(node.operator || "AND").toUpperCase() === "OR" ? "OR" : "AND",
      conditions: node.conditions.map(normalizeConditionNode),
    };
  }

  return {
    ...node,
    operator: CONDITION_OPERATOR_MAP[node.operator] || node.operator,
  };
}

function adaptFlowActionToTriggerAction(action = {}) {
  const config = { ...(action.config || {}) };

  switch (action.type) {
    case "setField":
      return {
        type: "updateField",
        config: {
          field: config.field,
          value: config.value,
        },
      };

    case "setBoolean":
      return {
        type: "updateField",
        config: {
          field: config.field,
          value: Boolean(config.value),
        },
      };

    case "setStatus":
      return {
        type: "updateField",
        config: {
          field: config.field || "status",
          value: config.value,
        },
      };

    case "createRecord":
      return {
        type: "createRecord",
        config,
      };

    default:
      return null;
  }
}

function adaptFlowToTrigger(flow = {}) {
  return {
    name: flow.name,
    isActive: flow.isActive !== false,
    when: flow.when,
    runOrder: Number(flow.runOrder || 0),
    stopOnError: flow.stopOnError !== false,
    conditions: normalizeConditionNode(flow.conditions),
    actions: (flow.actions || [])
      .map(adaptFlowActionToTriggerAction)
      .filter(Boolean),
  };
}

async function resolveObjectDefinition(objectApiName, providedDefinition = null) {
  if (providedDefinition?.apiName === objectApiName) {
    return providedDefinition;
  }

  return CustomObject.findOne({ apiName: objectApiName }).lean();
}

function validateConditionTree(node, objectDefinition, errors, path = "conditions") {
  if (!node) return;

  if (Array.isArray(node)) {
    node.forEach((entry, index) =>
      validateConditionTree(entry, objectDefinition, errors, `${path}[${index}]`)
    );
    return;
  }

  if (Array.isArray(node.conditions)) {
    node.conditions.forEach((entry, index) =>
      validateConditionTree(entry, objectDefinition, errors, `${path}.conditions[${index}]`)
    );
    return;
  }

  if (!node.field) {
    errors.push(`${path}: falta field`);
    return;
  }

  if (!fieldExists(objectDefinition, node.field)) {
    errors.push(`${path}: campo no existe (${node.field})`);
  }

  const normalizedOperator = CONDITION_OPERATOR_MAP[node.operator] || node.operator;
  if (!normalizedOperator || !Object.values(CONDITION_OPERATOR_MAP).includes(normalizedOperator)) {
    errors.push(`${path}: operador no soportado (${node.operator})`);
  }
}

async function validateFlowDefinition(flow, options = {}) {
  const errors = [];
  const objectApiName = normalizeObjectApiName(flow?.objectApiName);

  if (!objectApiName) {
    errors.push("objectApiName es requerido");
  }

  if (!flow?.name) {
    errors.push("name es requerido");
  }

  if (!FLOW_EVENTS.includes(flow?.when)) {
    errors.push(`when no soportado (${flow?.when || ""})`);
  }

  const objectDefinition = await resolveObjectDefinition(
    objectApiName,
    options.objectDefinition || null
  );

  if (!objectDefinition) {
    errors.push(`Objeto no encontrado (${objectApiName})`);
    return { valid: false, errors };
  }

  validateConditionTree(flow?.conditions, objectDefinition, errors);

  const actions = flow?.actions || [];
  if (!actions.length) {
    errors.push("Debe existir al menos una accion");
  }

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const basePath = `actions[${index}]`;

    if (!["setField", "setBoolean", "setStatus", "createRecord"].includes(action?.type)) {
      errors.push(`${basePath}: tipo no soportado (${action?.type || ""})`);
      continue;
    }

    if (action.type === "createRecord") {
      const targetObjectApiName = normalizeObjectApiName(action?.config?.object);
      if (!targetObjectApiName) {
        errors.push(`${basePath}: object es requerido`);
        continue;
      }

      const targetObject = await CustomObject.findOne({ apiName: targetObjectApiName }).lean();
      if (!targetObject) {
        errors.push(`${basePath}: objeto destino no existe (${targetObjectApiName})`);
      }
      continue;
    }

    const targetField = action?.config?.field || (action.type === "setStatus" ? "status" : "");
    const fieldDefinition = getFieldDefinition(objectDefinition, targetField);

    if (!fieldDefinition) {
      errors.push(`${basePath}: campo destino no existe (${targetField})`);
      continue;
    }

    if (action.type === "setBoolean" && fieldDefinition.type !== "boolean") {
      errors.push(`${basePath}: ${targetField} no es boolean`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    objectDefinition,
  };
}

async function listExecutableFlows({ objectApiName, when }) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const normalizedObjectApiName = normalizeObjectApiName(objectApiName);
  if (!normalizedObjectApiName || !when) {
    return [];
  }

  const flows = await AutomationFlow.find({
    objectApiName: normalizedObjectApiName,
    when,
    isActive: true,
  })
    .sort({ runOrder: 1, createdAt: 1, _id: 1 })
    .lean();

  return flows.map(adaptFlowToTrigger);
}

async function ensureUniqueApiName({ apiName, excludeId = null }) {
  if (!apiName) return;

  const existing = await AutomationFlow.findOne({
    apiName,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();

  if (existing) {
    throw createHttpError(409, `Ya existe un flow con apiName ${apiName}`);
  }
}

function buildPersistedFlowPayload(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    apiName: normalizeApiName(payload.apiName || payload.name),
    description: String(payload.description || ""),
    objectApiName: normalizeObjectApiName(payload.objectApiName),
    isActive: payload.isActive !== false,
    when: payload.when,
    runOrder: Number(payload.runOrder || 0),
    stopOnError: payload.stopOnError !== false,
    conditions: normalizeConditionNode(payload.conditions),
    actions: Array.isArray(payload.actions) ? payload.actions : [],
  };
}

async function listFlows(filters = {}) {
  const query = {};

  if (filters.objectApiName) {
    query.objectApiName = normalizeObjectApiName(filters.objectApiName);
  }

  if (filters.when) {
    query.when = filters.when;
  }

  if (typeof filters.isActive === "boolean") {
    query.isActive = filters.isActive;
  }

  return AutomationFlow.find(query).sort({ objectApiName: 1, runOrder: 1, createdAt: -1 }).lean();
}

async function getFlowById(flowId) {
  const flow = await AutomationFlow.findById(flowId);
  if (!flow) {
    throw createHttpError(404, "Flow no encontrado");
  }

  return flow;
}

async function createFlow(payload = {}) {
  const normalizedPayload = buildPersistedFlowPayload(payload);
  const validation = await validateFlowDefinition(normalizedPayload);

  if (!validation.valid) {
    throw createHttpError(400, validation.errors.join(" | "), {
      details: { errors: validation.errors },
    });
  }

  await ensureUniqueApiName({ apiName: normalizedPayload.apiName });
  return AutomationFlow.create(normalizedPayload);
}

async function updateFlow(flowId, payload = {}) {
  const current = await getFlowById(flowId);
  const mergedPayload = buildPersistedFlowPayload({
    ...current.toObject(),
    ...payload,
  });

  const validation = await validateFlowDefinition(mergedPayload);
  if (!validation.valid) {
    throw createHttpError(400, validation.errors.join(" | "), {
      details: { errors: validation.errors },
    });
  }

  await ensureUniqueApiName({
    apiName: mergedPayload.apiName,
    excludeId: String(current._id),
  });

  current.set(mergedPayload);
  await current.save();
  return current;
}

async function deleteFlow(flowId) {
  const deleted = await AutomationFlow.findByIdAndDelete(flowId);
  if (!deleted) {
    throw createHttpError(404, "Flow no encontrado");
  }

  return { success: true };
}

module.exports = {
  FLOW_EVENTS,
  adaptFlowToTrigger,
  buildPersistedFlowPayload,
  createFlow,
  deleteFlow,
  getFlowById,
  listExecutableFlows,
  listFlows,
  normalizeApiName,
  normalizeObjectApiName,
  updateFlow,
  validateFlowDefinition,
};

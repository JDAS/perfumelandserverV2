const mongoose = require("mongoose");
const CustomObject = require("../models/CustomObject");
const ReportDefinition = require("../models/ReportDefinition");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { createHttpError } = require("../utils/httpError");
const {
  sanitizeObjectPayload,
  validateObjectMetadata,
} = require("../utils/objectMetadata");

const OBJECT_TRIGGER_CONFIG_KEYS = [
  "object",
  "targetObject",
  "paymentObject",
  "productObject",
  "stockObject",
];

function normalizeObjectApiName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function hasBlockingDependencies(dependencies) {
  return (
    dependencies.recordCount > 0 ||
    dependencies.lookupReferences.length > 0 ||
    dependencies.rollupReferences.length > 0 ||
    dependencies.relatedListReferences.length > 0 ||
    dependencies.reportReferences.length > 0 ||
    dependencies.triggerReferences.length > 0
  );
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function buildDeletionBlockedMessage(targetObject, dependencies) {
  const summaryParts = [];

  if (dependencies.recordCount > 0) {
    summaryParts.push(
      `${dependencies.recordCount} ${pluralize(
        dependencies.recordCount,
        "registro",
        "registros"
      )}`
    );
  }

  if (dependencies.lookupReferences.length > 0) {
    summaryParts.push(
      `${dependencies.lookupReferences.length} ${pluralize(
        dependencies.lookupReferences.length,
        "lookup",
        "lookups"
      )} en otros objetos`
    );
  }

  if (dependencies.rollupReferences.length > 0) {
    summaryParts.push(
      `${dependencies.rollupReferences.length} ${pluralize(
        dependencies.rollupReferences.length,
        "rollup",
        "rollups"
      )}`
    );
  }

  if (dependencies.relatedListReferences.length > 0) {
    summaryParts.push(
      `${dependencies.relatedListReferences.length} ${pluralize(
        dependencies.relatedListReferences.length,
        "lista relacionada",
        "listas relacionadas"
      )}`
    );
  }

  if (dependencies.reportReferences.length > 0) {
    summaryParts.push(
      `${dependencies.reportReferences.length} ${pluralize(
        dependencies.reportReferences.length,
        "reporte",
        "reportes"
      )}`
    );
  }

  if (dependencies.triggerReferences.length > 0) {
    summaryParts.push(
      `${dependencies.triggerReferences.length} ${pluralize(
        dependencies.triggerReferences.length,
        "trigger",
        "triggers"
      )}`
    );
  }

  return `No se puede eliminar el objeto "${targetObject.apiName}" porque tiene ${summaryParts.join(
    ", "
  )}.`;
}

async function countObjectRecords(apiName) {
  const RecordModel = getCustomRecordModel(apiName);
  return RecordModel.countDocuments();
}

function collectTriggerReferences(objectDefinition, targetApiName) {
  const references = [];

  for (const trigger of objectDefinition.automationTriggers || []) {
    for (const action of trigger.actions || []) {
      const config = action?.config || {};

      for (const configKey of OBJECT_TRIGGER_CONFIG_KEYS) {
        if (normalizeObjectApiName(config?.[configKey]) !== targetApiName) {
          continue;
        }

        references.push({
          objectApiName: objectDefinition.apiName,
          objectName: objectDefinition.name,
          triggerName: trigger.name || "Trigger sin nombre",
          actionType: action.type || "accion",
          configKey,
        });
      }
    }
  }

  return references;
}

function collectObjectReferences(objectDefinition, targetApiName) {
  const lookupReferences = [];
  const rollupReferences = [];
  const relatedListReferences = [];

  for (const field of objectDefinition.fields || []) {
    if (normalizeObjectApiName(field.referenceTo) === targetApiName) {
      lookupReferences.push({
        objectApiName: objectDefinition.apiName,
        objectName: objectDefinition.name,
        fieldApiName: field.apiName,
        fieldLabel: field.label,
      });
    }

    if (normalizeObjectApiName(field.rollup?.relatedObject) === targetApiName) {
      rollupReferences.push({
        objectApiName: objectDefinition.apiName,
        objectName: objectDefinition.name,
        fieldApiName: field.apiName,
        fieldLabel: field.label,
      });
    }
  }

  for (const layout of objectDefinition.layout || []) {
    for (const section of layout.sections || []) {
      if (normalizeObjectApiName(section.relatedObject) !== targetApiName) {
        continue;
      }

      relatedListReferences.push({
        objectApiName: objectDefinition.apiName,
        objectName: objectDefinition.name,
        layoutApiName: layout.apiName,
        layoutLabel: layout.label,
        sectionLabel: section.label,
      });
    }
  }

  return {
    lookupReferences,
    rollupReferences,
    relatedListReferences,
    triggerReferences: collectTriggerReferences(objectDefinition, targetApiName),
  };
}

async function collectObjectDeletionDependencies(targetObject) {
  const targetApiName = normalizeObjectApiName(targetObject.apiName);

  const [recordCount, siblingObjects, reportReferences] = await Promise.all([
    countObjectRecords(targetApiName),
    CustomObject.find({ apiName: { $ne: targetApiName } }).lean(),
    ReportDefinition.find({ sourceObject: targetApiName })
      .select("name apiName")
      .lean(),
  ]);

  const dependencies = {
    recordCount,
    lookupReferences: [],
    rollupReferences: [],
    relatedListReferences: [],
    reportReferences: reportReferences.map((report) => ({
      id: String(report._id),
      apiName: report.apiName,
      name: report.name,
    })),
    triggerReferences: [],
  };

  for (const objectDefinition of siblingObjects) {
    const objectReferences = collectObjectReferences(objectDefinition, targetApiName);
    dependencies.lookupReferences.push(...objectReferences.lookupReferences);
    dependencies.rollupReferences.push(...objectReferences.rollupReferences);
    dependencies.relatedListReferences.push(...objectReferences.relatedListReferences);
    dependencies.triggerReferences.push(...objectReferences.triggerReferences);
  }

  return dependencies;
}

async function dropObjectCollectionIfExists(apiName) {
  const db = mongoose.connection?.db;
  if (!db) return false;

  const collections = await db
    .listCollections({ name: apiName }, { nameOnly: true })
    .toArray();

  if (!collections.length) {
    return false;
  }

  try {
    await db.dropCollection(apiName);
    return true;
  } catch (error) {
    if (
      error?.codeName === "NamespaceNotFound" ||
      /ns not found|namespace not found/i.test(error?.message || "")
    ) {
      return false;
    }

    throw error;
  }
}

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

async function deleteObject(apiName) {
  const normalizedApiName = normalizeObjectApiName(apiName);
  const existing = await CustomObject.findOne({ apiName: normalizedApiName });

  if (!existing) {
    throw createHttpError(404, "Objeto no encontrado");
  }

  const dependencies = await collectObjectDeletionDependencies(existing);

  if (hasBlockingDependencies(dependencies)) {
    throw createHttpError(
      409,
      buildDeletionBlockedMessage(existing, dependencies),
      {
        details: {
          objectApiName: existing.apiName,
          objectName: existing.name,
          ...dependencies,
        },
      }
    );
  }

  await dropObjectCollectionIfExists(existing.apiName);
  await existing.deleteOne();

  return { message: "Objeto eliminado correctamente" };
}

module.exports = {
  createObject,
  updateObject,
  deleteObject,
};

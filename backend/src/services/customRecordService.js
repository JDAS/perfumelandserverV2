const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { applyFormulaFields } = require("../utils/formulaEngine");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");
const { buildDefaultPayload, validateRecordPayload } = require("./recordValidationService");
const { runTriggers } = require("./triggerMotor");
const { syncInventoryForProducts } = require("./inventorySyncService");
const {
  resolveLookupData,
  listRecords: listRecordsWithMetadata,
  getRecordByIdEnriched: getRecordByIdEnrichedWithMetadata,
  getRelatedRecords: getRelatedRecordsWithMetadata,
} = require("./customRecordQueryService");

async function getObjectOrThrow(apiName) {
  const customObject = await CustomObject.findOne({ apiName }).lean();
  if (!customObject) {
    const error = new Error("Objeto no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return customObject;
}

async function getRecordOrThrow(objectApiName, recordId) {
  const RecordModel = getCustomRecordModel(objectApiName);
  const record = await RecordModel.findById(recordId);
  if (!record) {
    const error = new Error("Registro no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return record;
}

async function listRecords(apiName, params = {}) {
  const objectDefinition = await getObjectOrThrow(apiName);
  return listRecordsWithMetadata({ objectDefinition, params });
}

async function getRecordByIdEnriched(apiName, recordId) {
  const objectDefinition = await getObjectOrThrow(apiName);
  return getRecordByIdEnrichedWithMetadata({ objectDefinition, recordId });
}

async function getRelatedRecords(
  parentObjectApiName,
  parentId,
  relatedObjectApiName,
  relatedField,
  options = {}
) {
  const parentObjectDef = await getObjectOrThrow(parentObjectApiName);
  const relatedObjectDef = await getObjectOrThrow(relatedObjectApiName);
  return getRelatedRecordsWithMetadata({
    parentObjectDefinition: parentObjectDef,
    parentId,
    relatedObjectDefinition: relatedObjectDef,
    relatedField,
    options,
  });
}

async function saveRecord({ objectApiName, recordId = null, payload = {}, user = null }) {
  const objectDefinition = await getObjectOrThrow(objectApiName);
  const RecordModel = getCustomRecordModel(objectApiName);
  const isUpdate = Boolean(recordId);

  let existingRecord = null;
  let previousRecord = null;

  if (isUpdate) {
    existingRecord = await getRecordOrThrow(objectApiName, recordId);
    previousRecord =
      typeof existingRecord.toObject === "function"
        ? existingRecord.toObject()
        : { ...existingRecord };
  }

  const payloadWithDefaults = isUpdate
    ? payload
    : { ...buildDefaultPayload(objectDefinition), ...(payload || {}) };

  const validation = await validateRecordPayload(payloadWithDefaults, objectDefinition, {
    partial: isUpdate,
  });

  const allErrors = [
    ...validation.errors,
    ...validation.invalidFields.map((field) => `Campo no permitido: ${field}`),
  ];

  if (allErrors.length > 0) {
    const error = new Error(allErrors.join(" | "));
    error.statusCode = 400;
    error.details = {
      errors: validation.errors,
      invalidFields: validation.invalidFields,
      blockedFields: validation.blockedFields,
    };
    throw error;
  }

  const baseRecord = isUpdate ? previousRecord : {};

  let finalData = applyFormulaFields(objectDefinition.fields, {
    ...baseRecord,
    ...validation.sanitizedPayload,
  });

  // ===== BEFORE TRIGGERS =====
  const beforeEvent = isUpdate ? "beforeUpdate" : "beforeInsert";

  finalData = await runTriggers({
    objectDefinition,
    when: beforeEvent,
    objectApiName,
    record: finalData,
    previousRecord,
  });

  // Reaplicar formulas por si un trigger cambia campos base
  finalData = applyFormulaFields(objectDefinition.fields, finalData);
  // ===== FIN BEFORE TRIGGERS =====

  let record;
  if (isUpdate) {
    existingRecord.set(finalData);

    // Marcar campos dinamicos como modificados para persistir cambios flexibles
    Object.keys(finalData).forEach((key) => {
      existingRecord.markModified(key);
    });

    if (user?._id) {
      existingRecord.set("updatedBy", user._id);
      existingRecord.markModified("updatedBy");
    }

    record = await existingRecord.save();
  } else {
    const createData = { ...finalData };

    if (user?._id) {
      createData.createdBy = user._id;
      createData.updatedBy = user._id;
    }

    record = await RecordModel.create(createData);
  }

  const plainRecord =
    typeof record.toObject === "function" ? record.toObject() : { ...record };

  // ===== AFTER TRIGGERS =====
  const afterEvent = isUpdate ? "afterUpdate" : "afterInsert";

  await runTriggers({
    objectDefinition,
    when: afterEvent,
    objectApiName,
    record: plainRecord,
    previousRecord,
  });
  // ===== FIN AFTER TRIGGERS =====

  await recalculateParentRollupsFromChild({
    childObjectApiName: objectApiName,
    childRecord: plainRecord,
    previousChildRecord: previousRecord,
  });

  if (objectApiName === "stock" || objectApiName === "sale_item") {
    await syncInventoryForProducts([
      previousRecord?.product,
      plainRecord?.product,
    ]);
  }

  return {
    mode: isUpdate ? "update" : "create",
    objectDefinition,
    record,
    previousRecord,
    blockedFields: validation.blockedFields,
  };
}
async function deleteRecordWithTriggers({ objectApiName, recordId }) {
  const objectDefinition = await getObjectOrThrow(objectApiName);
  const RecordModel = getCustomRecordModel(objectApiName);

  const existingRecord = await RecordModel.findById(recordId);
  if (!existingRecord) {
    const error = new Error("Registro no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const previousRecord =
    typeof existingRecord.toObject === "function"
      ? existingRecord.toObject()
      : { ...existingRecord };

  await runTriggers({
    objectDefinition,
    when: "beforeDelete",
    objectApiName,
    record: previousRecord,
    previousRecord,
  });

  await RecordModel.findByIdAndDelete(recordId);

  await runTriggers({
    objectDefinition,
    when: "afterDelete",
    objectApiName,
    record: previousRecord,
    previousRecord,
  });

  await recalculateParentRollupsFromChild({
    childObjectApiName: objectApiName,
    childRecord: null,
    previousChildRecord: previousRecord,
  });

  if (objectApiName === "stock" || objectApiName === "sale_item") {
    await syncInventoryForProducts([previousRecord?.product]);
  }

  return { success: true };
}

module.exports = {
  getObjectOrThrow,
  getRecordOrThrow,
  listRecords,
  getRecordByIdEnriched,
  getRelatedRecords,
  saveRecord,
  resolveLookupData,
  deleteRecordWithTriggers,
};

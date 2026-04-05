const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { applyFormulaFields } = require("../utils/formulaEngine");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");
const { validateRecordPayload } = require("./recordValidationService");
const { runTriggers } = require("./triggerEngine");

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

function parseFilters(filtersInput) {
  if (!filtersInput) return [];

  try {
    const parsed =
      typeof filtersInput === "string" ? JSON.parse(filtersInput) : filtersInput;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildFilterCondition(filter) {
  const { field, operator, value } = filter || {};

  if (!field || value === undefined || value === null || value === "") {
    return null;
  }

  switch (operator) {
    case "eq":
      return { [field]: value };
    case "ne":
      return { [field]: { $ne: value } };
    case "gt":
      return { [field]: { $gt: value } };
    case "gte":
      return { [field]: { $gte: value } };
    case "lt":
      return { [field]: { $lt: value } };
    case "lte":
      return { [field]: { $lte: value } };
    case "contains":
      return { [field]: { $regex: String(value), $options: "i" } };
    default:
      return null;
  }
}

function buildMongoQuery({ objectDefinition, search, filters, viewFilters }) {
  const query = {};
  const andConditions = [];

  if (search && String(search).trim()) {
    const searchableFields = (objectDefinition.fields || [])
      .filter((f) =>
        [
          "text",
          "textarea",
          "select",
          "date",
          "number",
          "email",
          "phone",
          "lookup",
          "url",
        ].includes(f.type)
      )
      .map((f) => f.apiName);

    if (searchableFields.length > 0) {
      query.$or = searchableFields.map((field) => ({
        [field]: { $regex: String(search).trim(), $options: "i" },
      }));
    }
  }

  [...(filters || []), ...(viewFilters || [])]
    .map(buildFilterCondition)
    .filter(Boolean)
    .forEach((condition) => andConditions.push(condition));

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  return query;
}

async function resolveLookupData(records, objectDefinition) {
  const plainRecords = records.map((record) =>
    typeof record?.toObject === "function" ? record.toObject() : { ...record }
  );

  const lookupFields = (objectDefinition?.fields || []).filter(
    (field) => field.type === "lookup" && field.referenceTo
  );

  if (!lookupFields.length || !plainRecords.length) {
    return plainRecords;
  }

  const idsByReference = new Map();

  for (const field of lookupFields) {
    for (const record of plainRecords) {
      const relatedId = record[field.apiName];
      if (!relatedId) continue;

      const refName = field.referenceTo;
      if (!idsByReference.has(refName)) {
        idsByReference.set(refName, new Set());
      }

      idsByReference.get(refName).add(String(relatedId));
    }
  }

  const relatedDataByReference = new Map();

  await Promise.all(
    [...idsByReference.entries()].map(async ([referenceTo, idsSet]) => {
      try {
        const RelatedModel = getCustomRecordModel(referenceTo);
        const docs = await RelatedModel.find({
          _id: { $in: [...idsSet] },
        }).lean();

        relatedDataByReference.set(
          referenceTo,
          new Map(
            docs.map((doc) => [
              String(doc._id),
              {
                _id: doc._id,
                label:
                  doc.name ||
                  doc.label ||
                  doc.title ||
                  doc.fullName ||
                  String(doc._id),
                record: doc,
              },
            ])
          )
        );
      } catch (error) {
        console.error(`lookup resolve batch error (${referenceTo}):`, error);
        relatedDataByReference.set(referenceTo, new Map());
      }
    })
  );

  return plainRecords.map((record) => {
    const enriched = { ...record, _lookup: record._lookup || {} };

    for (const field of lookupFields) {
      const relatedId = record[field.apiName];
      if (!relatedId) continue;

      const relatedMap = relatedDataByReference.get(field.referenceTo);
      const related = relatedMap?.get(String(relatedId));

      if (related) {
        enriched._lookup[field.apiName] = related;
      }
    }

    return enriched;
  });
}

async function listRecords(apiName, params = {}) {
  const objectDefinition = await getObjectOrThrow(apiName);
  const RecordModel = getCustomRecordModel(apiName);

  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);

  const viewApiName = params.view || "all";
  const activeView =
    objectDefinition.listViews?.find((v) => v.apiName === viewApiName) ||
    objectDefinition.listViews?.find((v) => v.isDefault) ||
    null;

  const sortField =
    params.sort || params.sortBy || activeView?.sortBy || "createdAt";
  const sortOrderRaw =
    params.order || params.sortOrder || activeView?.sortOrder || "desc";
  const sortOrder = sortOrderRaw === "asc" ? 1 : -1;

  const filters = parseFilters(params.filters);
  const viewFilters = Array.isArray(activeView?.filters) ? activeView.filters : [];

  const query = buildMongoQuery({
    objectDefinition,
    search: params.search,
    filters,
    viewFilters,
  });

  const [rawRecords, total] = await Promise.all([
    RecordModel.find(query)
      .sort({ [sortField]: sortOrder, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RecordModel.countDocuments(query),
  ]);

  const lookupResolved = await resolveLookupData(rawRecords, objectDefinition);

  const records = lookupResolved.map((record) =>
    applyFormulaFields(objectDefinition.fields, record)
  );

  const pages = Math.max(Math.ceil(total / limit), 1);

  return {
    records,
    total,
    page,
    pages,
    limit,
    view: viewApiName,
    sort: sortField,
    order: sortOrder === 1 ? "asc" : "desc",
    pagination: {
      page,
      pages,
      total,
      limit,
      totalPages: pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
}

async function getRecordByIdEnriched(apiName, recordId) {
  const objectDefinition = await getObjectOrThrow(apiName);
  const RecordModel = getCustomRecordModel(apiName);

  const record = await RecordModel.findById(recordId).lean();
  if (!record) {
    const error = new Error("Registro no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const [enriched] = await resolveLookupData([record], objectDefinition);

  return applyFormulaFields(objectDefinition.fields, enriched);
}

async function getRelatedRecords(parentObjectApiName, parentId, relatedObjectApiName, relatedField) {
  const parentObjectDef = await getObjectOrThrow(parentObjectApiName);
  const relatedObjectDef = await getObjectOrThrow(relatedObjectApiName);

  const ParentModel = getCustomRecordModel(parentObjectApiName);
  const parentRecord = await ParentModel.findById(parentId).lean();

  if (!parentRecord) {
    const error = new Error("Registro padre no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const RelatedModel = getCustomRecordModel(relatedObjectApiName);

  const rawRecords = await RelatedModel.find({
    [relatedField]: String(parentRecord._id),
  })
    .sort({ createdAt: -1 })
    .lean();

  const lookupResolved = await resolveLookupData(rawRecords, relatedObjectDef);

  return {
    records: lookupResolved.map((record) =>
      applyFormulaFields(relatedObjectDef.fields, record)
    ),
    total: rawRecords.length,
    parentObjectDef,
    relatedObjectDef,
  };
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

  const validation = await validateRecordPayload(payload, objectDefinition, {
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

  // Reaplicar fórmulas por si un trigger cambió campos base
  finalData = applyFormulaFields(objectDefinition.fields, finalData);
  // ===== FIN BEFORE TRIGGERS =====

  let record;
  if (isUpdate) {
    Object.assign(existingRecord, finalData);
    existingRecord.updatedBy = user?._id || existingRecord.updatedBy;
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
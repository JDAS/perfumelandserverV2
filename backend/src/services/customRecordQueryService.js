const { getCustomRecordModel } = require("../models/CustomRecord");
const { applyFormulaFields } = require("../utils/formulaEngine");

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
      .filter((field) =>
        [
          "text",
          "textarea",
          "select",
          "date",
          "number",
          "percentage",
          "email",
          "phone",
          "lookup",
          "url",
        ].includes(field.type)
      )
      .map((field) => field.apiName);

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

function buildLookupLabel(doc = {}, referenceTo = "") {
  const baseLabel =
    doc.name || doc.label || doc.title || doc.fullName || String(doc._id || "");

  if (
    referenceTo === "product" &&
    doc.volume !== undefined &&
    doc.volume !== null &&
    doc.volume !== ""
  ) {
    return `${baseLabel} - ${doc.volume} ml`;
  }

  return baseLabel;
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

      if (!idsByReference.has(field.referenceTo)) {
        idsByReference.set(field.referenceTo, new Set());
      }

      idsByReference.get(field.referenceTo).add(String(relatedId));
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
                label: buildLookupLabel(doc, referenceTo),
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

async function listRecords({ objectDefinition, params = {} }) {
  const RecordModel = getCustomRecordModel(objectDefinition.apiName);

  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);

  const viewApiName = params.view || "all";
  const activeView =
    objectDefinition.listViews?.find((view) => view.apiName === viewApiName) ||
    objectDefinition.listViews?.find((view) => view.isDefault) ||
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

async function getRecordByIdEnriched({ objectDefinition, recordId }) {
  const RecordModel = getCustomRecordModel(objectDefinition.apiName);

  const record = await RecordModel.findById(recordId).lean();
  if (!record) {
    const error = new Error("Registro no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const [enriched] = await resolveLookupData([record], objectDefinition);

  return applyFormulaFields(objectDefinition.fields, enriched);
}

async function getRelatedRecords({
  parentObjectDefinition,
  parentId,
  relatedObjectDefinition,
  relatedField,
  options = {},
}) {
  const ParentModel = getCustomRecordModel(parentObjectDefinition.apiName);
  const parentRecord = await ParentModel.findById(parentId).lean();

  if (!parentRecord) {
    const error = new Error("Registro padre no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const RelatedModel = getCustomRecordModel(relatedObjectDefinition.apiName);

  const rawRecords = await RelatedModel.find({
    [relatedField]: String(parentRecord._id),
  })
    .sort({
      [options.sortField || "createdAt"]: options.sortOrder === "asc" ? 1 : -1,
      _id: -1,
    })
    .lean();

  const lookupResolved = await resolveLookupData(rawRecords, relatedObjectDefinition);

  return {
    records: lookupResolved.map((record) =>
      applyFormulaFields(relatedObjectDefinition.fields, record)
    ),
    total: rawRecords.length,
    parentObjectDef: parentObjectDefinition,
    relatedObjectDef: relatedObjectDefinition,
  };
}

module.exports = {
  resolveLookupData,
  listRecords,
  getRecordByIdEnriched,
  getRelatedRecords,
};

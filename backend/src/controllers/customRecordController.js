const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const {
  applyFormulaFields,
  removeFormulaFields,
} = require("../utils/formulaEngine");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");

async function resolveLookupData(records, customObject) {
  const lookupFields = (customObject?.fields || []).filter(
    (field) => field.type === "lookup" && field.referenceTo
  );

  if (!lookupFields.length) {
    return records.map((record) =>
      typeof record.toObject === "function" ? record.toObject() : record
    );
  }

  const enrichedRecords = [];

  for (const record of records) {
    const plainRecord =
      typeof record.toObject === "function" ? record.toObject() : { ...record };

    plainRecord._lookup = plainRecord._lookup || {};

    for (const field of lookupFields) {
      const relatedId = plainRecord[field.apiName];

      if (!relatedId) continue;

      try {
        const RelatedModel = getCustomRecordModel(field.referenceTo);
        const relatedRecord = await RelatedModel.findById(relatedId);

        if (relatedRecord) {
          const relatedPlain =
            typeof relatedRecord.toObject === "function"
              ? relatedRecord.toObject()
              : relatedRecord;

          plainRecord._lookup[field.apiName] = {
            _id: relatedPlain._id,
            label:
              relatedPlain.name ||
              relatedPlain.label ||
              relatedPlain.title ||
              relatedPlain.fullName ||
              String(relatedPlain._id),
            record: relatedPlain,
          };
        }
      } catch (error) {
        console.error(
          `lookup resolve error (${field.apiName} -> ${field.referenceTo}):`,
          error
        );
      }
    }

    enrichedRecords.push(plainRecord);
  }

  return enrichedRecords;
}

exports.createRecord = async (req, res) => {
  try {
    const { object } = req.params;
    const RecordModel = getCustomRecordModel(object);

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const cleaned = removeFormulaFields(customObject.fields, req.body);
    const finalData = applyFormulaFields(customObject.fields, cleaned);

    const record = await RecordModel.create(finalData);

    await recalculateParentRollupsFromChild({
      childObjectApiName: object,
      childRecord: record.toObject ? record.toObject() : record,
    });

    res.status(201).json(record);
  } catch (error) {
    console.error("createRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const { object } = req.params;

    const {
      view = "all",
      search = "",
      page = 1,
      limit = 10,
      sort,
      order,
      sortBy,
      sortOrder,
      filters,
    } = req.query;

    const finalSort = sort || sortBy || "createdAt";
    const finalOrder = order || sortOrder || "desc";

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const RecordModel = getCustomRecordModel(object);

    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;
    const skip = (numericPage - 1) * numericLimit;

    const mongoQuery = {};

    const activeView =
      customObject.listViews?.find((v) => v.apiName === view) ||
      customObject.listViews?.find((v) => v.isDefault) ||
      null;

    if (search && String(search).trim()) {
      const searchableFields = (customObject.fields || [])
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
          ].includes(f.type)
        )
        .map((f) => f.apiName);

      if (searchableFields.length > 0) {
        mongoQuery.$or = searchableFields.map((field) => ({
          [field]: { $regex: String(search).trim(), $options: "i" },
        }));
      }
    }

    const parsedFilterConditions = [];

    if (filters) {
      let parsedFilters = [];

      try {
        parsedFilters =
          typeof filters === "string" ? JSON.parse(filters) : filters;
      } catch (e) {
        console.error("Error parseando filters:", e);
      }

      if (Array.isArray(parsedFilters)) {
        parsedFilters.forEach((filter) => {
          const { field, operator, value } = filter || {};
          if (!field || value === undefined || value === null || value === "")
            return;

          switch (operator) {
            case "eq":
              parsedFilterConditions.push({ [field]: value });
              break;
            case "ne":
              parsedFilterConditions.push({ [field]: { $ne: value } });
              break;
            case "gt":
              parsedFilterConditions.push({ [field]: { $gt: value } });
              break;
            case "gte":
              parsedFilterConditions.push({ [field]: { $gte: value } });
              break;
            case "lt":
              parsedFilterConditions.push({ [field]: { $lt: value } });
              break;
            case "lte":
              parsedFilterConditions.push({ [field]: { $lte: value } });
              break;
            case "contains":
              parsedFilterConditions.push({
                [field]: { $regex: String(value), $options: "i" },
              });
              break;
            default:
              break;
          }
        });
      }
    }

    if (
      activeView &&
      Array.isArray(activeView.filters) &&
      activeView.filters.length > 0
    ) {
      activeView.filters.forEach((filter) => {
        const { field, operator, value } = filter || {};
        if (!field || value === undefined || value === null || value === "")
          return;

        switch (operator) {
          case "eq":
            parsedFilterConditions.push({ [field]: value });
            break;
          case "ne":
            parsedFilterConditions.push({ [field]: { $ne: value } });
            break;
          case "gt":
            parsedFilterConditions.push({ [field]: { $gt: value } });
            break;
          case "gte":
            parsedFilterConditions.push({ [field]: { $gte: value } });
            break;
          case "lt":
            parsedFilterConditions.push({ [field]: { $lt: value } });
            break;
          case "lte":
            parsedFilterConditions.push({ [field]: { $lte: value } });
            break;
          case "contains":
            parsedFilterConditions.push({
              [field]: { $regex: String(value), $options: "i" },
            });
            break;
          default:
            break;
        }
      });
    }

    if (parsedFilterConditions.length > 0) {
      mongoQuery.$and = parsedFilterConditions;
    }

    const sortConfig = {
      [finalSort]: finalOrder === "asc" ? 1 : -1,
    };

    const total = await RecordModel.countDocuments(mongoQuery);

    const rawRecords = await RecordModel.find(mongoQuery)
      .sort(sortConfig)
      .skip(skip)
      .limit(numericLimit);

    const lookupResolved = await resolveLookupData(rawRecords, customObject);

    const records = lookupResolved.map((record) =>
      applyFormulaFields(customObject.fields, record)
    );

    res.json({
      records,
      total,
      page: numericPage,
      pages: Math.ceil(total / numericLimit),
      view,
      sort: finalSort,
      order: finalOrder,
      limit: numericLimit,
      pagination: {
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
        total,
        limit: numericLimit,
      },
    });
  } catch (error) {
    console.error("getRecords error:", error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
};

exports.getRelatedRecords = async (req, res) => {
  try {
    const { object, id, relatedObject, relatedField } = req.params;

    const parentObjectDef = await CustomObject.findOne({ apiName: object });
    if (!parentObjectDef) {
      return res.status(404).json({ error: "Objeto padre no encontrado" });
    }

    const relatedObjectDef = await CustomObject.findOne({
      apiName: relatedObject,
    });
    if (!relatedObjectDef) {
      return res
        .status(404)
        .json({ error: "Objeto relacionado no encontrado" });
    }

    const ParentModel = getCustomRecordModel(object);
    const parentRecord = await ParentModel.findById(id);

    if (!parentRecord) {
      return res.status(404).json({ error: "Registro padre no encontrado" });
    }

    const RelatedModel = getCustomRecordModel(relatedObject);

    const rawRecords = await RelatedModel.find({
      [relatedField]: String(parentRecord._id),
    }).sort({ createdAt: -1 });

    const lookupResolved = await resolveLookupData(rawRecords, relatedObjectDef);

    const records = lookupResolved.map((record) =>
      applyFormulaFields(relatedObjectDef.fields, record)
    );

    res.json({
      records,
      total: records.length,
    });
  } catch (error) {
    console.error("getRelatedRecords error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const { object, id } = req.params;

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const RecordModel = getCustomRecordModel(object);
    const record = await RecordModel.findById(id);

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const [enrichedRecord] = await resolveLookupData([record], customObject);

    const finalRecord = applyFormulaFields(customObject.fields, enrichedRecord);

    res.json(finalRecord);
  } catch (error) {
    console.error("getRecordById error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const { object, id } = req.params;
    const RecordModel = getCustomRecordModel(object);

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const existing = await RecordModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const previousRecord = existing.toObject();

    const cleaned = removeFormulaFields(customObject.fields, req.body);

    const merged = {
      ...previousRecord,
      ...cleaned,
    };

    const finalData = applyFormulaFields(customObject.fields, merged);

    const record = await RecordModel.findByIdAndUpdate(id, finalData, {
      new: true,
      runValidators: true,
    });

    await recalculateParentRollupsFromChild({
      childObjectApiName: object,
      childRecord: record.toObject ? record.toObject() : record,
      previousChildRecord: previousRecord,
    });

    res.json(record);
  } catch (error) {
    console.error("updateRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { object, id } = req.params;
    const RecordModel = getCustomRecordModel(object);

    const existing = await RecordModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const previousRecord = existing.toObject();

    await RecordModel.findByIdAndDelete(id);

    await recalculateParentRollupsFromChild({
      childObjectApiName: object,
      childRecord: null,
      previousChildRecord: previousRecord,
    });

    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    console.error("deleteRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};
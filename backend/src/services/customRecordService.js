const CustomObject = require('../models/CustomObject');
const { getCustomRecordModel } = require('../models/CustomRecord');
const { applyFormulaFields } = require('../utils/formulaEngine');
const { recalculateParentRollupsFromChild } = require('../utils/rollupEngine');
const { validateRecordPayload } = require('./recordValidationService');

async function getObjectOrThrow(apiName) {
  const customObject = await CustomObject.findOne({ apiName });
  if (!customObject) {
    const error = new Error('Objeto no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return customObject;
}

async function getRecordOrThrow(objectApiName, recordId) {
  const RecordModel = getCustomRecordModel(objectApiName);
  const record = await RecordModel.findById(recordId);
  if (!record) {
    const error = new Error('Registro no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return record;
}

function buildMongoQuery({ objectDefinition, search, filtersJson }) {
  const query = {};

  if (search) {
    const searchableFields = (objectDefinition.fields || []).filter((field) => ['text', 'textarea', 'email', 'phone', 'url', 'select'].includes(field.type));
    if (searchableFields.length > 0) {
      query.$or = searchableFields.map((field) => ({
        [field.apiName]: { $regex: search, $options: 'i' },
      }));
    }
  }

  if (filtersJson) {
    try {
      const filters = JSON.parse(filtersJson);
      if (Array.isArray(filters)) {
        for (const filter of filters) {
          if (!filter?.field || filter.value === undefined || filter.value === '') continue;
          query[filter.field] = filter.operator === 'ne' ? { $ne: filter.value } : filter.value;
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
  const sortField = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
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

async function saveRecord({ objectApiName, recordId = null, payload = {}, user = null }) {
  const objectDefinition = await getObjectOrThrow(objectApiName);
  const RecordModel = getCustomRecordModel(objectApiName);
  const isUpdate = Boolean(recordId);

  let existingRecord = null;
  let previousRecord = null;

  if (isUpdate) {
    existingRecord = await getRecordOrThrow(objectApiName, recordId);
    previousRecord = typeof existingRecord.toObject === 'function' ? existingRecord.toObject() : { ...existingRecord };
  }

  const validation = await validateRecordPayload(payload, objectDefinition, {
    partial: isUpdate,
  });

  const allErrors = [
    ...validation.errors,
    ...validation.invalidFields.map((field) => `Campo no permitido: ${field}`),
  ];

  if (allErrors.length > 0) {
    const error = new Error(allErrors.join(' | '));
    error.statusCode = 400;
    error.details = {
      errors: validation.errors,
      invalidFields: validation.invalidFields,
      blockedFields: validation.blockedFields,
    };
    throw error;
  }

  const baseRecord = isUpdate ? previousRecord : {};
  const finalData = applyFormulaFields(objectDefinition.fields, {
    ...baseRecord,
    ...validation.sanitizedPayload,
  });

  let record;
  if (isUpdate) {
    Object.assign(existingRecord, finalData);
    if (user?._id && !existingRecord.updatedBy) {
      existingRecord.updatedBy = user._id;
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

  const plainRecord = typeof record.toObject === 'function' ? record.toObject() : { ...record };

  await recalculateParentRollupsFromChild({
    childObjectApiName: objectApiName,
    childRecord: plainRecord,
    previousChildRecord: previousRecord,
  });

  return {
    mode: isUpdate ? 'update' : 'create',
    objectDefinition,
    record,
    previousRecord,
    blockedFields: validation.blockedFields,
  };
}

module.exports = {
  getObjectOrThrow,
  getRecordOrThrow,
  listRecords,
  saveRecord,
};

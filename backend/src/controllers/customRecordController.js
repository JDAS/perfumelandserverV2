const {
  listRecords,
  getRecordByIdEnriched,
  getRelatedRecords,
  saveRecord,
  deleteRecordWithTriggers,
} = require("../services/customRecordService");
const { buildClientSummary } = require("../services/clientSummaryService");
const { convertQuoteToSale } = require("../services/quoteConversionService");
const { syncSaleCampaigns } = require("../services/campaignSyncService");
const { createHttpError } = require("../utils/httpError");

exports.createRecord = async (req, res) => {
  const { object } = req.params;

  const result = await saveRecord({
    objectApiName: object,
    payload: req.body,
    user: req.user || null,
  });

  res.status(201).json({
    record: result.record,
    blockedFields: result.blockedFields,
  });
};

exports.getRecords = async (req, res) => {
  const { object } = req.params;

  const result = await listRecords(object, req.query);

  res.json(result);
};

exports.getRelatedRecords = async (req, res) => {
  const { object, id, relatedObject, relatedField } = req.params;

  const result = await getRelatedRecords(
    object,
    id,
    relatedObject,
    relatedField,
    {
      sortField: req.query.sortField,
      sortOrder: req.query.sortOrder,
    }
  );

  res.json({
    records: result.records,
    total: result.total,
  });
};

exports.getRecordById = async (req, res) => {
  const { object, id } = req.params;

  const record = await getRecordByIdEnriched(object, id);

  res.json(record);
};

exports.getClientSummary = async (req, res) => {
  const { object, id } = req.params;
  const summary = await buildClientSummary(object, id);
  res.json(summary);
};

exports.convertQuoteToSale = async (req, res) => {
  const { object, id } = req.params;

  if (object !== "quote") {
    throw createHttpError(400, "Esta accion solo aplica a cotizaciones");
  }

  const result = await convertQuoteToSale({
    quoteId: id,
    user: req.user || null,
  });

  res.json(result);
};

exports.syncSaleCampaigns = async (req, res) => {
  const { object, id } = req.params;

  if (object !== "sales") {
    throw createHttpError(400, "Esta accion solo aplica a ventas");
  }

  const result = await syncSaleCampaigns({
    saleId: id,
    user: req.user || null,
  });

  res.json(result);
};

exports.updateRecord = async (req, res) => {
  const { object, id } = req.params;

  const result = await saveRecord({
    objectApiName: object,
    recordId: id,
    payload: req.body,
    user: req.user || null,
  });

  res.json({
    record: result.record,
    blockedFields: result.blockedFields,
  });
};

exports.deleteRecord = async (req, res) => {
  const { object, id } = req.params;

  await deleteRecordWithTriggers({
    objectApiName: object,
    recordId: id,
  });

  res.json({ message: "Registro eliminado correctamente" });
};

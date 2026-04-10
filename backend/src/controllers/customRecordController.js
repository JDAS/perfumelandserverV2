const { getCustomRecordModel } = require("../models/CustomRecord");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");
const {
  listRecords,
  getRecordByIdEnriched,
  getRelatedRecords,
  saveRecord,
  deleteRecordWithTriggers,
} = require("../services/customRecordService");
const { buildClientSummary } = require("../services/clientSummaryService");

exports.createRecord = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("createRecord error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details || undefined,
    });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const { object } = req.params;

    const result = await listRecords(object, req.query);

    res.json(result);
  } catch (error) {
    console.error("getRecords error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
};

exports.getRelatedRecords = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("getRelatedRecords error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const { object, id } = req.params;

    const record = await getRecordByIdEnriched(object, id);

    res.json(record);
  } catch (error) {
    console.error("getRecordById error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
};

exports.getClientSummary = async (req, res) => {
  try {
    const { object, id } = req.params;
    const summary = await buildClientSummary(object, id);
    res.json(summary);
  } catch (error) {
    console.error("getClientSummary error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
};

exports.updateRecord = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("updateRecord error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details || undefined,
    });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { object, id } = req.params;

    await deleteRecordWithTriggers({
      objectApiName: object,
      recordId: id,
    });

    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    console.error("deleteRecord error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
};

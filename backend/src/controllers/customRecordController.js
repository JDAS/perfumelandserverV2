const { getCustomRecordModel } = require("../models/CustomRecord");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");
const {
  listRecords,
  getRecordByIdEnriched,
  getRelatedRecords,
  saveRecord,
} = require("../services/customRecordService");

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
      relatedField
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
    const RecordModel = getCustomRecordModel(object);

    const existing = await RecordModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const previousRecord =
      typeof existing.toObject === "function" ? existing.toObject() : existing;

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
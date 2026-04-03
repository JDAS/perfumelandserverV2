const mongoose = require("mongoose");
const getCustomRecordModel = require("../models/CustomRecord");
const {
  getObjectOrThrow,
  sanitizeRecordPayload,
  validateRecordPayload,
  listRecords,
} = require("../services/customRecordService");

exports.createRecord = async (req, res) => {
  try {
    const { object } = req.params;
    const customObject = await getObjectOrThrow(object);

    const { sanitized, invalidFields } = sanitizeRecordPayload(req.body, customObject);
    if (invalidFields.length > 0) {
      return res.status(400).json({ error: `Campos no permitidos: ${invalidFields.join(", ")}` });
    }

    const errors = validateRecordPayload(sanitized, customObject);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" | ") });
    }

    const RecordModel = getCustomRecordModel(object);
    const record = await RecordModel.create(sanitized);

    res.status(201).json(record);
  } catch (error) {
    console.error("createRecord error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const result = await listRecords(req.params.object, req.query);
    res.json(result);
  } catch (error) {
    console.error("getRecords error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const { object, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    await getObjectOrThrow(object);

    const RecordModel = getCustomRecordModel(object);
    const record = await RecordModel.findById(id);

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json(record);
  } catch (error) {
    console.error("getRecordById error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const { object, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    const customObject = await getObjectOrThrow(object);
    const { sanitized, invalidFields } = sanitizeRecordPayload(req.body, customObject);

    if (invalidFields.length > 0) {
      return res.status(400).json({ error: `Campos no permitidos: ${invalidFields.join(", ")}` });
    }

    const RecordModel = getCustomRecordModel(object);
    const currentRecord = await RecordModel.findById(id);
    if (!currentRecord) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const mergedPayload = {
      ...currentRecord.toObject(),
      ...sanitized,
    };

    const errors = validateRecordPayload(mergedPayload, customObject, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" | ") });
    }

    const updated = await RecordModel.findByIdAndUpdate(id, sanitized, {
      new: true,
      runValidators: false,
    });

    res.json(updated);
  } catch (error) {
    console.error("updateRecord error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { object, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Id inválido" });
    }

    await getObjectOrThrow(object);

    const RecordModel = getCustomRecordModel(object);
    const deleted = await RecordModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    console.error("deleteRecord error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

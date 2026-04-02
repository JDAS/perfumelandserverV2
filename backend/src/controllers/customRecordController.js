const getCustomRecordModel = require("../models/CustomRecord");
const CustomObject = require("../models/CustomObject");

exports.createRecord = async (req, res) => {
  try {
    const { object } = req.params;

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const allowedFields = customObject.fields.map((f) => f.apiName);
    const requiredFields = customObject.fields
      .filter((f) => f.required)
      .map((f) => f.apiName);

    const incomingFields = Object.keys(req.body);

    const invalidFields = incomingFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: `Campos no permitidos: ${invalidFields.join(", ")}`,
      });
    }

    const missingRequired = requiredFields.filter(
      (field) =>
        req.body[field] === undefined ||
        req.body[field] === null ||
        req.body[field] === ""
    );

    if (missingRequired.length > 0) {
      return res.status(400).json({
        error: `Faltan campos requeridos: ${missingRequired.join(", ")}`,
      });
    }

    const RecordModel = getCustomRecordModel(object);
    const record = await RecordModel.create(req.body);

    res.status(201).json(record);
  } catch (error) {
    console.error("createRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const { object } = req.params;

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const RecordModel = getCustomRecordModel(object);
    const records = await RecordModel.find();

    res.json(records);
  } catch (error) {
    console.error("getRecords error:", error);
    res.status(500).json({ error: error.message });
  }
};
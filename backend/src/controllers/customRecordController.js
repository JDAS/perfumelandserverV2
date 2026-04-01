const CustomRecord = require("../models/CustomRecord");

// Crear registro dinámico
exports.createRecord = async (req, res) => {
  try {
    const { object } = req.params;

    const record = await CustomRecord.create({
      object,
      data: req.body,
    });

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener registros por objeto
exports.getRecords = async (req, res) => {
  try {
    const { object } = req.params;

    const records = await CustomRecord.find({ object });

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const CustomObject = require("../models/CustomObject");

// Crear objeto
exports.createObject = async (req, res) => {
  try {
    const object = await CustomObject.create(req.body);
    res.status(201).json(object);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos
exports.getObjects = async (req, res) => {
  try {
    const objects = await CustomObject.find();
    res.json(objects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const CustomObject = require("../models/CustomObject");

// Crear objeto
exports.createObject = async (req, res) => {
  try {
    const { name, apiName, fields = [], layout = [] } = req.body;

    const object = await CustomObject.create({
      name,
      apiName,
      fields,
      layout,
    });

    res.status(201).json(object);
  } catch (error) {
    console.error(error); // 🔥 importante para logs
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
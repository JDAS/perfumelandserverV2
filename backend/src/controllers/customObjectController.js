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

// Obtener un objeto por apiName
exports.getObjectByApiName = async (req, res) => {
  try {
    const { apiName } = req.params;

    const object = await CustomObject.findOne({ apiName });

    if (!object) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    res.json(object);
  } catch (error) {
    console.error("getObjectByApiName error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Actualizar objeto completo
exports.updateObject = async (req, res) => {
  try {
    const { apiName } = req.params;

    const updated = await CustomObject.findOneAndUpdate(
      { apiName },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    res.json(updated);
  } catch (error) {
    console.error("updateObject error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteObject = async (req, res) => {
  try {
    const { apiName } = req.params;

    const deleted = await CustomObject.findOneAndDelete({ apiName });

    if (!deleted) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    res.json({ message: "Objeto eliminado correctamente" });
  } catch (error) {
    console.error("deleteObject error:", error);
    res.status(500).json({ error: error.message });
  }
};
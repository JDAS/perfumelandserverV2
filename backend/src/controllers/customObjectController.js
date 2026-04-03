const CustomObject = require("../models/CustomObject");
const {
  createObject: createObjectService,
  updateObject: updateObjectService,
} = require("../services/customObjectService");

exports.createObject = async (req, res) => {
  try {
    const object = await createObjectService(req.body);
    res.status(201).json(object);
  } catch (error) {
    console.error("createObject error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.getObjects = async (_req, res) => {
  try {
    const objects = await CustomObject.find().sort({ createdAt: -1 });
    res.json(objects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getObjectByApiName = async (req, res) => {
  try {
    const object = await CustomObject.findOne({ apiName: req.params.apiName });

    if (!object) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    res.json(object);
  } catch (error) {
    console.error("getObjectByApiName error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateObject = async (req, res) => {
  try {
    const updated = await updateObjectService(req.params.apiName, req.body);
    res.json(updated);
  } catch (error) {
    console.error("updateObject error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.deleteObject = async (req, res) => {
  try {
    const deleted = await CustomObject.findOneAndDelete({ apiName: req.params.apiName });

    if (!deleted) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    res.json({ message: "Objeto eliminado correctamente" });
  } catch (error) {
    console.error("deleteObject error:", error);
    res.status(500).json({ error: error.message });
  }
};

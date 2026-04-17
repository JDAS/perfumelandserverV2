const CustomObject = require("../models/CustomObject");
const {
  createObject: createObjectService,
  deleteObject: deleteObjectService,
  updateObject: updateObjectService,
} = require("../services/customObjectService");
const { createHttpError } = require("../utils/httpError");

exports.createObject = async (req, res) => {
  const object = await createObjectService(req.body);
  res.status(201).json(object);
};

exports.getObjects = async (_req, res) => {
  const objects = await CustomObject.find().sort({ createdAt: -1 });
  res.json(objects);
};

exports.getObjectByApiName = async (req, res) => {
  const object = await CustomObject.findOne({ apiName: req.params.apiName });

  if (!object) {
    throw createHttpError(404, "Objeto no encontrado");
  }

  res.json(object);
};

exports.updateObject = async (req, res) => {
  const updated = await updateObjectService(req.params.apiName, req.body);
  res.json(updated);
};

exports.deleteObject = async (req, res) => {
  const result = await deleteObjectService(req.params.apiName);
  res.json(result);
};

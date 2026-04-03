const mongoose = require("mongoose");

const customRecordSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    timestamps: true,
  }
);

function getCustomRecordModel(objectName) {
  const modelName = `custom_${objectName}`;

  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  return mongoose.model(modelName, customRecordSchema, objectName);
}

module.exports = {
  getCustomRecordModel,
};
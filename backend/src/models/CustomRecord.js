const mongoose = require("mongoose");

const customRecordSchema = new mongoose.Schema(
  {},
  { strict: false, timestamps: true }
);

customRecordSchema.index({ createdAt: -1 });
customRecordSchema.index({ updatedAt: -1 });

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
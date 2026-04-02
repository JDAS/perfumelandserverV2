const mongoose = require("mongoose");

function getCustomRecordModel(collectionName) {
  const modelName = `CustomRecord_${collectionName}`;

  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  const customRecordSchema = new mongoose.Schema(
    {},
    {
      strict: false,
      timestamps: true,
    }
  );

  return mongoose.model(modelName, customRecordSchema, collectionName);
}

module.exports = getCustomRecordModel;
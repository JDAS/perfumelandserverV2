const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  label: String,
  name: String,
  type: String, // text, number, select
  required: Boolean,
  options: [String],
});

const customObjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    apiName: {
      type: String,
      required: true,
      unique: true,
    },
    fields: [fieldSchema],
    layout: [layoutSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomObject", customObjectSchema);
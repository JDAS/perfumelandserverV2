const mongoose = require("mongoose");

const flowActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["setField", "setBoolean", "setStatus", "createRecord"],
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const flowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    apiName: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    objectApiName: { type: String, required: true, trim: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    when: {
      type: String,
      required: true,
      enum: [
        "beforeInsert",
        "afterInsert",
        "beforeUpdate",
        "afterUpdate",
        "beforeDelete",
        "afterDelete",
      ],
      index: true,
    },
    runOrder: { type: Number, default: 0 },
    stopOnError: { type: Boolean, default: true },
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        operator: "AND",
        conditions: [],
      },
    },
    actions: {
      type: [flowActionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AutomationFlow", flowSchema);

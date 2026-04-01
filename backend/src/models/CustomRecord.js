const mongoose = require("mongoose");

const customRecordSchema = new mongoose.Schema(
  {
    object: {
      type: String, // apiName del objeto (ej: "product")
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed, // 🔥 dinámico
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomRecord", customRecordSchema);
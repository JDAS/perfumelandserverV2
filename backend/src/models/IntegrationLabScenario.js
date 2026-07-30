const mongoose = require("mongoose");

const integrationLabScenarioSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    acceptedMethods: {
      type: [String],
      default: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
    failFirst: { type: Number, min: 0, max: 100, default: 1 },
    failureStatus: {
      type: Number,
      enum: [400, 401, 403, 408, 409, 422, 429, 500, 502, 503, 504],
      default: 503,
    },
    successStatus: {
      type: Number,
      enum: [200, 201, 202, 204],
      default: 200,
    },
    attempts: { type: Number, min: 0, default: 0 },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "integration_lab_scenarios" }
);

integrationLabScenarioSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("IntegrationLabScenario", integrationLabScenarioSchema);

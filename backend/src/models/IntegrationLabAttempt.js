const mongoose = require("mongoose");

const integrationLabAttemptSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, index: true },
    scenarioKey: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true },
    method: { type: String, required: true },
    authMode: { type: String, required: true },
    responseStatus: { type: Number, required: true },
    query: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: null },
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "integration_lab_attempts" }
);

integrationLabAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
integrationLabAttemptSchema.index({ scenarioKey: 1, attemptNumber: 1 });

module.exports = mongoose.model("IntegrationLabAttempt", integrationLabAttemptSchema);

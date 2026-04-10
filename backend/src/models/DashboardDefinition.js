const mongoose = require("mongoose");

const dashboardWidgetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["kpi", "chart", "table"], required: true },
    title: { type: String, required: true },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportDefinition",
      required: true,
    },
    chartType: {
      type: String,
      enum: ["bar", "line", "pie", "area"],
      default: "bar",
    },
    xField: { type: String, default: "" },
    series: { type: [String], default: [] },
    columns: { type: [String], default: [] },
    metricId: { type: String, default: "" },
    size: {
      type: String,
      enum: ["full", "half", "third"],
      default: "half",
    },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const dashboardDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    widgets: { type: [dashboardWidgetSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DashboardDefinition", dashboardDefinitionSchema);

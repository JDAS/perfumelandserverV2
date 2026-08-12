const mongoose = require("mongoose");

const reportFilterSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "isEmpty", "notEmpty"],
      default: "eq",
    },
    value: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const reportGroupBySchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    label: { type: String, default: "" },
    dateGroup: {
      type: String,
      enum: ["none", "day", "month", "year"],
      default: "none",
    },
  },
  { _id: false }
);

const reportMetricSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    operation: {
      type: String,
      enum: ["count", "sum", "avg", "min", "max"],
      required: true,
    },
    field: { type: String, default: "*" },
    format: {
      type: String,
      enum: ["number", "currency", "percent", "text"],
      default: "number",
    },
  },
  { _id: false }
);

const reportSortSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    direction: { type: String, enum: ["asc", "desc"], default: "desc" },
  },
  { _id: false }
);

const reportDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    engine: {
      type: String,
      enum: [
        "standard",
        "financial_summary",
        "seller_year_performance",
        "payments_by_day",
        "price_review",
        "upcoming_payments",
        "street_investment",
        "campaign_performance",
        "seller_campaign_performance",
        "cash_profitability",
        "inventory_reconciliation",
        "cash_available",
      ],
      default: "standard",
    },
    sourceObject: { type: String, required: true, trim: true },
    filters: { type: [reportFilterSchema], default: [] },
    groupBy: { type: [reportGroupBySchema], default: [] },
    metrics: { type: [reportMetricSchema], default: [] },
    columns: { type: [String], default: [] },
    sort: { type: [reportSortSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

reportDefinitionSchema.index({ sourceObject: 1, isActive: 1 });

module.exports = mongoose.model("ReportDefinition", reportDefinitionSchema);

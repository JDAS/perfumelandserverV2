const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema(
  {
    label: String,
    apiName: String,
    type: String,
    required: Boolean,
    options: [String],
    defaultValue: mongoose.Schema.Types.Mixed,
    referenceTo: String,
    onParentDelete: {
      type: String,
      enum: ["", "cascade", "restrict", "detach", "ignore"],
      default: "",
    },
    lookupFilters: [
      {
        field: String,
        operator: String,
        value: mongoose.Schema.Types.Mixed,
      },
    ],
    visibleInList: { type: Boolean, default: true },
    visibleInDetail: { type: Boolean, default: true },
    visibleInForm: { type: Boolean, default: true },
    formula: {
      expression: { type: String, default: "" },
      returnType: {
        type: String,
        enum: ["text", "number", "boolean", "date"],
        default: "text",
      },
    },
    rollup: {
      relatedObject: { type: String, default: "" },
      relatedField: { type: String, default: "" },
      operation: {
        type: String,
        enum: ["count", "sum", "avg", "min", "max"],
        default: "count",
      },
      fieldToAggregate: { type: String, default: "" },
      filterField: { type: String, default: "" },
      filterOperator: { type: String, default: "eq" },
      filterValue: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  { _id: false }
);

const layoutSectionSchema = new mongoose.Schema(
  {
    label: String,
    type: { type: String, default: "fields" },
    columns: { type: Number, default: 2 },
    fields: [String],
    relatedObject: { type: String, default: "" },
    relatedField: { type: String, default: "" },
    relatedColumns: { type: [String], default: [] },
    sortField: { type: String, default: "" },
    sortOrder: { type: String, enum: ["asc", "desc"], default: "desc" },
  },
  { _id: false }
);

const layoutSchema = new mongoose.Schema(
  {
    label: String,
    apiName: String,
    sections: [layoutSectionSchema],
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const listViewFilterSchema = new mongoose.Schema(
  {
    field: String,
    operator: String,
    value: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const listViewSchema = new mongoose.Schema(
  {
    label: String,
    apiName: String,
    isDefault: { type: Boolean, default: false },
    columns: [String],
    filters: [listViewFilterSchema],
    sortBy: String,
    sortOrder: { type: String, enum: ["asc", "desc"], default: "desc" },
  },
  { _id: false }
);

// ===== NUEVO: TRIGGERS =====
const triggerActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["updateField", "copyFromLookup", "createRecord", "log", "generatePayments", "generatePaymentPlan", "setSaleItemPrice", "syncSaleItemStatus", "setSalePaymentStatus"],
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const automationTriggerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
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
      type: [triggerActionSchema],
      default: [],
    },
  },
  { _id: false }
);
// ===== FIN NUEVO =====

const customObjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    pluralLabel: { type: String, default: "" },
    apiName: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    tabsEnabled: { type: Boolean, default: true },
    fields: { type: [fieldSchema], default: [] },
    layout: { type: [layoutSchema], default: [] },
    listViews: { type: [listViewSchema], default: [] },

    // ===== NUEVO =====
    automationTriggers: {
      type: [automationTriggerSchema],
      default: [],
    },
    // ===== FIN NUEVO =====
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomObject", customObjectSchema);

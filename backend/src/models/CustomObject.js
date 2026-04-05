const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema(
  {
    label: String,
    apiName: String,
    type: String,
    required: Boolean,
    options: [String],
    referenceTo: String,
    visibleInList: { type: Boolean, default: true },
    visibleInDetail: { type: Boolean, default: true },
    visibleInForm: { type: Boolean, default: true },
    formula: { type: String, default: "" },
    rollup: {
      relationshipField: { type: String, default: "" },
      aggregateField: { type: String, default: "" },
      operation: {
        type: String,
        enum: ["count", "sum", "avg", "min", "max"],
        default: "count",
      },
      filterField: { type: String, default: "" },
      filterValue: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  { _id: false }
);

const layoutSectionSchema = new mongoose.Schema(
  {
    label: String,
    columns: { type: Number, default: 2 },
    fields: [String],
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
const triggerConditionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: [
        "eq",
        "ne",
        "gt",
        "gte",
        "lt",
        "lte",
        "contains",
        "changed",
        "isEmpty",
        "isNotEmpty",
      ],
    },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const triggerActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["updateField", "copyFromLookup", "createRecord", "log"],
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
      type: [triggerConditionSchema],
      default: [],
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
    apiName: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
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
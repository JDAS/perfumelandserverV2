const mongoose = require("mongoose");
const { FIELD_TYPES } = require("../utils/objectMetadata");

const fieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true },
    type: { type: String, default: "text", enum: FIELD_TYPES },
    referenceTo: { type: String, default: "", trim: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    visibleInList: { type: Boolean, default: true },
    visibleInDetail: { type: Boolean, default: true },
    visibleInForm: { type: Boolean, default: true },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      default: "fields",
      enum: ["fields", "relatedList"],
    },
    columns: { type: Number, required: true, default: 1 },

    fields: { type: [String], default: [] },

    relatedObject: { type: String, default: "", trim: true },
    relatedField: { type: String, default: "", trim: true },
    relatedColumns: { type: [String], default: [] },
  },
  { _id: false }
);

const layoutSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true },
    sections: { type: [sectionSchema], default: [] },
  },
  { _id: false }
);

const listViewFilterSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: {
      type: String,
      default: "eq",
      enum: ["eq", "ne", "gt", "gte", "lt", "lte", "contains"],
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const listViewSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    columns: { type: [String], default: [] },
    filters: { type: [listViewFilterSchema], default: [] },
    sortBy: { type: String, default: "createdAt" },
    sortOrder: { type: String, default: "desc", enum: ["asc", "desc"] },
  },
  { _id: false }
);

const customObjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    pluralLabel: { type: String, trim: true },
    description: { type: String, trim: true, default: "" },
    apiName: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
    tabsEnabled: { type: Boolean, default: true },
    fields: { type: [fieldSchema], default: [] },
    layout: { type: [layoutSchema], default: [] },
    listViews: { type: [listViewSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomObject", customObjectSchema);
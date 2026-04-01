const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  label: {
    type: String,
    default: "Name"
  },
  apiName: {
    type: String,
    required: true,
    default: function() {
      return this.label.toLowerCase().replace(/\s+/g, "_");
    },
    // ⚠️ Unique a nivel global puede causar conflicto; mejor manejarlo en la app
  },
  type: {
    type: String,
    default: "text"
  },
  required: {
    type: Boolean,
    default: false
  },
  options: {
    type: [String],
    default: []
  }
});

const sectionSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    default: "Detalles"
  },
  columns: {
    type: Number,
    required: true,
    default: 1
  },
  fields: {
    type: [String],
    default: ["name"]
  }
});

const layoutSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    default: "principal"
  },
  apiName: {
    type: String,
    required: true,
    default: function() {
      return this.label.toLowerCase().replace(/\s+/g, "_");
    }
  },
  sections: {
    type: [sectionSchema],
    default: [{ label: "Detalles", columns: 2, fields: ["name"] }]
  }
});

const customObjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Nuevo Objeto"
    },
    apiName: {
      type: String,
      required: true,
      default: function() {
        return this.name.toLowerCase().replace(/\s+/g, "_");
      },
      unique: true
    },
    fields: {
      type: [fieldSchema],
      default: [{ label: "Name", type: "text" }]
    },
    layout: {
      type: [layoutSchema],
      default: [{
        label: "principal",
        apiName: "principal",
        sections: [{ label: "Detalles", columns: 2, fields: ["name"] }]
      }]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomObject", customObjectSchema);
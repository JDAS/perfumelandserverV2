const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: "Name",
      trim: true,
    },
    apiName: {
      type: String,
      required: true,
      default: function () {
        return this.label.toLowerCase().replace(/\s+/g, "_");
      },
      trim: true,
    },
    type: {
      type: String,
      default: "text",
      enum: ["text", "number", "select", "date"],
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      default: "Detalles",
      trim: true,
    },
    columns: {
      type: Number,
      required: true,
      default: 1,
    },
    fields: {
      type: [String],
      default: ["name"],
    },
  },
  { _id: false }
);

const layoutSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      default: "principal",
      trim: true,
    },
    apiName: {
      type: String,
      required: true,
      default: function () {
        return this.label.toLowerCase().replace(/\s+/g, "_");
      },
      trim: true,
    },
    sections: {
      type: [sectionSchema],
      default: [{ label: "Detalles", columns: 2, fields: ["name"] }],
    },
  },
  { _id: false }
);

const customObjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Nuevo Objeto",
      trim: true,
    },
    apiName: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        return this.name.toLowerCase().replace(/\s+/g, "_");
      },
      trim: true,
    },
    fields: {
      type: [fieldSchema],
      default: [{ label: "Name", apiName: "name", type: "text" }],
    },
    layout: {
      type: [layoutSchema],
      default: [
        {
          label: "principal",
          apiName: "principal",
          sections: [
            {
              label: "Detalles",
              columns: 2,
              fields: ["name"],
            },
          ],
        },
      ],
    },
  },
  { timestamps: true }
);

customObjectSchema.pre("save", function () {
  if (!this.fields || this.fields.length === 0) {
    this.fields = [
      {
        label: "Name",
        apiName: "name",
        type: "text",
      },
    ];
  }

  if (!this.layout || this.layout.length === 0) {
    this.layout = [
      {
        label: "principal",
        apiName: "principal",
        sections: [
          {
            label: "Detalles",
            columns: 2,
            fields: ["name"],
          },
        ],
      },
    ];
  }
});

module.exports = mongoose.model("CustomObject", customObjectSchema);
const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  label: String,
  apiName: {
      type: String,
      required: true,
      default: function() {
        return this.label.toLowerCase().replace(/\s+/g, "_");
      },
      unique: true
    },
  type: String, // text, number, select
  required: Boolean,
  options: [String],
});
const sectionSchema = new mongoose.Schema({
    label:{
        type:String,
        required: true,
    },
    columns:{
        type:Number,
        required: true,
        default: 1,
    },
    fields:[String]
});
const layoutSchema = new mongoose.Schema({
    label:{
        type:String,
        required: true
    },
    apiName: {
      type: String,
      required: true,
      default: function() {
        return this.label.toLowerCase().replace(/\s+/g, "_");
      },
      unique: true
    },
    sections: {
      type:[sectionSchema],
      default:[{"label":"Detalles","columns":2,"fields":["name"]}]:
    },
});
const customObjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
        type:[fieldSchema],
        default:[{"label":"Name","type":"text"}]
    }, 
    layout: {
      type:[layoutSchema],
      default:[{"label":"principal"}]
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomObject", customObjectSchema);
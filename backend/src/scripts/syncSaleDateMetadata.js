const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const CustomObject = require("../models/CustomObject");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI no definido");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
  });

  const sales = await CustomObject.findOne({ apiName: "sales" });
  if (!sales) throw new Error("Metadata de sales no encontrada");
  const field = (sales.fields || []).find((item) => item.apiName === "saledate");
  if (!field) throw new Error("Campo sales.saledate no encontrado");

  field.required = true;
  field.defaultValue = { mode: "relative", offsetDays: 0 };
  sales.markModified("fields");
  await sales.save();

  console.log(JSON.stringify({
    object: "sales",
    field: "saledate",
    required: field.required,
    defaultValue: field.defaultValue,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

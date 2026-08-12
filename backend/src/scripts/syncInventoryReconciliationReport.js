const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ReportDefinition = require("../models/ReportDefinition");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI no definido");
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MIGRATION_TARGET_DB || "test" });
  const report = await ReportDefinition.findOneAndUpdate(
    { apiName: "inventory_reconciliation" },
    { $set: {
      name: "Conciliacion de inventario",
      apiName: "inventory_reconciliation",
      description: "Compara compras, ventas, costo FIFO, costo guardado y existencias por producto.",
      engine: "inventory_reconciliation",
      sourceObject: "stock",
      isActive: true,
      filters: [], groupBy: [], metrics: [], columns: [], sort: [],
    } },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();
  console.log(JSON.stringify({ id: report._id, apiName: report.apiName, name: report.name }, null, 2));
  await mongoose.disconnect();
}
main().catch((error) => { console.error(error); process.exit(1); });

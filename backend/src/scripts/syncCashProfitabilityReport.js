const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ReportDefinition = require("../models/ReportDefinition");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI no definido");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
  });

  const report = await ReportDefinition.findOneAndUpdate(
    { apiName: "cash_profitability" },
    {
      $set: {
        name: "Caja y rentabilidad",
        apiName: "cash_profitability",
        description: "Separa caja disponible, cuentas por cobrar y rentabilidad sin duplicar el costo del inventario.",
        engine: "cash_profitability",
        sourceObject: "sales",
        isActive: true,
        filters: [],
        groupBy: [],
        metrics: [],
        columns: [],
        sort: [],
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();

  console.log(JSON.stringify({ id: report._id, apiName: report.apiName, name: report.name }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

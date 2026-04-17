const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const ReportDefinition = require("../models/ReportDefinition");

async function run() {
  await connectDB();

  await ReportDefinition.updateOne(
    { apiName: "perfumes_with_stock" },
    {
      $set: {
        name: "Perfumes con stock",
        apiName: "perfumes_with_stock",
        description: "Listado de perfumes activos con inventario disponible mayor a cero.",
        engine: "standard",
        sourceObject: "product",
        filters: [
          { field: "track_inventory", operator: "eq", value: true },
          { field: "isactive", operator: "eq", value: true },
          { field: "available", operator: "gt", value: 0 },
        ],
        columns: [
          "name",
          "brand",
          "volume",
          "price",
          "purchaseditems",
          "sold",
          "available",
        ],
        sort: [
          { field: "available", direction: "desc" },
          { field: "name", direction: "asc" },
        ],
        groupBy: [],
        metrics: [],
        isActive: true,
      },
    },
    { upsert: true }
  );

  const report = await ReportDefinition.findOne({ apiName: "perfumes_with_stock" }).lean();
  console.log(
    JSON.stringify(
      {
        report: {
          id: report._id,
          apiName: report.apiName,
          name: report.name,
          sourceObject: report.sourceObject,
        },
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error("syncPerfumesWithStockReport error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

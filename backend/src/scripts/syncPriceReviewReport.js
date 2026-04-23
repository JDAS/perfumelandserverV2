const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const ReportDefinition = require("../models/ReportDefinition");

async function run() {
  await connectDB();

  await ReportDefinition.updateOne(
    { apiName: "price_review" },
    {
      $set: {
        name: "Revision de precios",
        apiName: "price_review",
        description:
          "Productos que requieren revision por riesgo contado, cambios fuertes del proveedor u ofertas.",
        engine: "price_review",
        sourceObject: "product",
        filters: [],
        columns: [],
        sort: [],
        groupBy: [],
        metrics: [],
        isActive: true,
      },
    },
    { upsert: true }
  );

  const report = await ReportDefinition.findOne({ apiName: "price_review" }).lean();
  console.log(
    JSON.stringify(
      {
        report: {
          id: report._id,
          apiName: report.apiName,
          name: report.name,
          engine: report.engine,
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
    console.error("syncPriceReviewReport error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

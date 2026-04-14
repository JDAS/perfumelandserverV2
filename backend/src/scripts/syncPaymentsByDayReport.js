const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const ReportDefinition = require("../models/ReportDefinition");

async function run() {
  await connectDB();

  await ReportDefinition.updateOne(
    { apiName: "payments_by_day" },
    {
      $set: {
        name: "Pagos por dia",
        apiName: "payments_by_day",
        description: "Detalle de pagos recibidos en una fecha especifica.",
        engine: "payments_by_day",
        sourceObject: "payment",
        filters: [],
        metrics: [],
        isActive: true,
      },
    },
    { upsert: true }
  );

  const report = await ReportDefinition.findOne({ apiName: "payments_by_day" }).lean();
  console.log(
    JSON.stringify(
      {
        report: {
          id: report._id,
          apiName: report.apiName,
          name: report.name,
          engine: report.engine,
        },
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error("syncPaymentsByDayReport error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

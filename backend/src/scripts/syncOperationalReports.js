const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const ReportDefinition = require("../models/ReportDefinition");

const reports = [
  {
    name: "Proximos pagos",
    apiName: "upcoming_payments",
    description: "Cuotas pendientes por cobrar con filtro por vendedor, vencimiento y rango de fechas.",
    engine: "upcoming_payments",
    sourceObject: "payment_plan",
  },
  {
    name: "Calle vs inversion",
    apiName: "street_investment",
    description: "Compara productos entregados en ventas con saldo pendiente contra la inversion de esos productos.",
    engine: "street_investment",
    sourceObject: "sale_item",
  },
];

async function run() {
  await connectDB();

  for (const report of reports) {
    await ReportDefinition.updateOne(
      { apiName: report.apiName },
      {
        $set: {
          ...report,
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
  }

  const savedReports = await ReportDefinition.find({
    apiName: { $in: reports.map((report) => report.apiName) },
  }).lean();

  console.log(
    JSON.stringify(
      {
        reports: savedReports.map((report) => ({
          id: report._id,
          apiName: report.apiName,
          name: report.name,
          engine: report.engine,
          sourceObject: report.sourceObject,
        })),
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error("syncOperationalReports error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

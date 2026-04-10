const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ReportDefinition = require("../models/ReportDefinition");
const DashboardDefinition = require("../models/DashboardDefinition");

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const reports = [
  {
    name: "Resumen de ventas",
    apiName: "sales_summary",
    description: "KPIs base de ventas completadas.",
    sourceObject: "sales",
    filters: [{ field: "status", operator: "eq", value: "Completada" }],
    metrics: [
      { id: "sales_count", label: "Ventas", operation: "count", field: "*", format: "number" },
      { id: "sales_total", label: "Total vendido", operation: "sum", field: "total", format: "currency" },
      { id: "paid_total", label: "Total cobrado", operation: "sum", field: "total_paid", format: "currency" },
      { id: "balance_total", label: "Saldo pendiente", operation: "sum", field: "balance_due", format: "currency" },
    ],
  },
  {
    name: "Ventas por dia",
    apiName: "sales_by_day",
    description: "Tendencia diaria de ventas completadas.",
    sourceObject: "sales",
    filters: [{ field: "status", operator: "eq", value: "Completada" }],
    groupBy: [{ field: "saledate", label: "Dia", dateGroup: "day" }],
    metrics: [
      { id: "sales_total", label: "Total vendido", operation: "sum", field: "total", format: "currency" },
      { id: "sales_count", label: "Ventas", operation: "count", field: "*", format: "number" },
    ],
    sort: [{ field: "saledate", direction: "asc" }],
  },
  {
    name: "Ventas por vendedor",
    apiName: "sales_by_seller",
    description: "Resumen comercial por vendedor.",
    sourceObject: "sales",
    filters: [{ field: "status", operator: "eq", value: "Completada" }],
    groupBy: [{ field: "seller_id", label: "Vendedor", dateGroup: "none" }],
    metrics: [
      { id: "sales_total", label: "Total vendido", operation: "sum", field: "total", format: "currency" },
      { id: "sales_count", label: "Ventas", operation: "count", field: "*", format: "number" },
    ],
    sort: [{ field: "sales_total", direction: "desc" }],
  },
  {
    name: "Mezcla de ventas",
    apiName: "sales_mix",
    description: "Contado vs credito.",
    sourceObject: "sales",
    filters: [{ field: "status", operator: "eq", value: "Completada" }],
    groupBy: [{ field: "type", label: "Tipo de venta", dateGroup: "none" }],
    metrics: [
      { id: "sales_total", label: "Total vendido", operation: "sum", field: "total", format: "currency" },
      { id: "sales_count", label: "Ventas", operation: "count", field: "*", format: "number" },
    ],
    sort: [{ field: "sales_total", direction: "desc" }],
  },
  {
    name: "Top productos",
    apiName: "top_products",
    description: "Productos mas vendidos en lineas completadas.",
    sourceObject: "sale_item",
    filters: [{ field: "sale_status", operator: "eq", value: "Completada" }],
    groupBy: [{ field: "product", label: "Producto", dateGroup: "none" }],
    metrics: [
      { id: "units_sold", label: "Unidades", operation: "sum", field: "quantity", format: "number" },
      { id: "sales_total", label: "Total vendido", operation: "sum", field: "total", format: "currency" },
    ],
    sort: [{ field: "units_sold", direction: "desc" }],
  },
  {
    name: "Cobro por estado",
    apiName: "collections_by_status",
    description: "Distribucion del estado de pago.",
    sourceObject: "sales",
    filters: [{ field: "status", operator: "eq", value: "Completada" }],
    groupBy: [{ field: "payment_status", label: "Estado de pago", dateGroup: "none" }],
    metrics: [
      { id: "sales_count", label: "Ventas", operation: "count", field: "*", format: "number" },
      { id: "balance_total", label: "Saldo", operation: "sum", field: "balance_due", format: "currency" },
    ],
    sort: [{ field: "sales_count", direction: "desc" }],
  },
];

async function upsertReport(definition) {
  const apiName = slugify(definition.apiName || definition.name);
  await ReportDefinition.updateOne(
    { apiName },
    {
      $set: {
        ...definition,
        apiName,
        isActive: true,
      },
    },
    { upsert: true }
  );

  return ReportDefinition.findOne({ apiName }).lean();
}

async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MIGRATION_TARGET_DB || "test";

  if (!uri) {
    throw new Error("MONGO_URI no definido");
  }

  await mongoose.connect(uri, { dbName });

  const savedReports = [];
  for (const definition of reports) {
    savedReports.push(await upsertReport(definition));
  }

  const byApiName = new Map(savedReports.map((report) => [report.apiName, report]));

  const dashboard = {
    name: "Resumen comercial",
    apiName: "sales_overview",
    description: "Dashboard base de ventas, cobranza y productos.",
    isActive: true,
    widgets: [
      {
        id: "kpi_sales_total",
        type: "kpi",
        title: "Total vendido",
        reportId: byApiName.get("sales_summary")._id,
        metricId: "sales_total",
        size: "third",
      },
      {
        id: "kpi_paid_total",
        type: "kpi",
        title: "Total cobrado",
        reportId: byApiName.get("sales_summary")._id,
        metricId: "paid_total",
        size: "third",
      },
      {
        id: "kpi_balance_total",
        type: "kpi",
        title: "Saldo pendiente",
        reportId: byApiName.get("sales_summary")._id,
        metricId: "balance_total",
        size: "third",
      },
      {
        id: "chart_sales_day",
        type: "chart",
        title: "Ventas por dia",
        reportId: byApiName.get("sales_by_day")._id,
        chartType: "line",
        xField: "saledate",
        series: ["sales_total"],
        size: "full",
      },
      {
        id: "chart_sales_seller",
        type: "chart",
        title: "Ventas por vendedor",
        reportId: byApiName.get("sales_by_seller")._id,
        chartType: "bar",
        xField: "seller_id",
        series: ["sales_total"],
        size: "half",
      },
      {
        id: "chart_sales_mix",
        type: "chart",
        title: "Contado vs credito",
        reportId: byApiName.get("sales_mix")._id,
        chartType: "pie",
        xField: "type",
        series: ["sales_total"],
        size: "half",
      },
      {
        id: "table_top_products",
        type: "table",
        title: "Top productos",
        reportId: byApiName.get("top_products")._id,
        columns: ["product", "units_sold", "sales_total"],
        size: "full",
      },
    ],
  };

  await DashboardDefinition.updateOne(
    { apiName: dashboard.apiName },
    { $set: dashboard },
    { upsert: true }
  );

  const savedDashboard = await DashboardDefinition.findOne({
    apiName: dashboard.apiName,
  }).lean();

  console.log(
    JSON.stringify(
      {
        reportsSeeded: savedReports.map((report) => ({
          id: report._id,
          apiName: report.apiName,
          name: report.name,
        })),
        dashboardSeeded: {
          id: savedDashboard._id,
          apiName: savedDashboard.apiName,
          name: savedDashboard.name,
          widgetCount: savedDashboard.widgets.length,
        },
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

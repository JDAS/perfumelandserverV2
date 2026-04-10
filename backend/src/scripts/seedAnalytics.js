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
    name: "Resumen financiero",
    apiName: "sales_summary",
    description: "Vista general de lo vendido, cobrado y lo que sigue en calle.",
    sourceObject: "sales",
    filters: [{ field: "status", operator: "eq", value: "Completada" }],
    metrics: [
      { id: "sales_count", label: "Ventas", operation: "count", field: "*", format: "number" },
      { id: "sales_total", label: "Total vendido", operation: "sum", field: "total", format: "currency" },
      { id: "paid_total", label: "Total cobrado", operation: "sum", field: "total_paid", format: "currency" },
      { id: "balance_total", label: "En calle", operation: "sum", field: "balance_due", format: "currency" },
    ],
  },
  {
    name: "Comportamiento diario de ventas",
    apiName: "sales_by_day",
    description: "Tendencia diaria de las ventas completadas.",
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
    name: "Rendimiento por vendedor",
    apiName: "sales_by_seller",
    description: "Comparativo del monto vendido por cada vendedor.",
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
    name: "Forma de pago",
    apiName: "sales_mix",
    description: "Distribucion entre ventas de contado y credito.",
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
    name: "Productos mas vendidos",
    apiName: "top_products",
    description: "Ranking de productos con mas salida en ventas completadas.",
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
    name: "Estado de las cuotas",
    apiName: "collections_by_status",
    description: "Panorama real de las cuotas pagadas, parciales, pendientes o vencidas.",
    sourceObject: "payment_plan",
    filters: [],
    groupBy: [{ field: "status", label: "Estado de cuota", dateGroup: "none" }],
    metrics: [
      { id: "installment_count", label: "Cuotas", operation: "count", field: "*", format: "number" },
      { id: "balance_total", label: "Saldo", operation: "sum", field: "remaining_amount", format: "currency" },
    ],
    sort: [{ field: "installment_count", direction: "desc" }],
  },
  {
    name: "Primer pago pendiente",
    apiName: "first_pending_installments",
    description: "Cuanto dinero sigue pendiente especificamente en la primera cuota.",
    sourceObject: "payment_plan",
    filters: [
      { field: "installment_number", operator: "eq", value: 1 },
      { field: "status", operator: "in", value: ["Pending", "Partial", "Overdue"] },
    ],
    metrics: [
      { id: "first_pending_total", label: "Primer pago pendiente", operation: "sum", field: "remaining_amount", format: "currency" },
      { id: "installment_count", label: "Cuotas abiertas", operation: "count", field: "*", format: "number" },
    ],
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
    name: "Reporte financiero",
    apiName: "sales_overview",
    description: "Lectura rapida del dinero vendido, cobrado, pendiente y el movimiento comercial.",
    isActive: true,
    widgets: [
      {
        id: "kpi_sales_total",
        type: "kpi",
        title: "Ventas acumuladas",
        reportId: byApiName.get("sales_summary")._id,
        metricId: "sales_total",
        size: "third",
      },
      {
        id: "kpi_paid_total",
        type: "kpi",
        title: "Dinero recibido",
        reportId: byApiName.get("sales_summary")._id,
        metricId: "paid_total",
        size: "third",
      },
      {
        id: "kpi_balance_total",
        type: "kpi",
        title: "En calle",
        reportId: byApiName.get("sales_summary")._id,
        metricId: "balance_total",
        size: "third",
      },
      {
        id: "kpi_first_pending",
        type: "kpi",
        title: "Primer pago pendiente",
        reportId: byApiName.get("first_pending_installments")._id,
        metricId: "first_pending_total",
        size: "third",
      },
      {
        id: "chart_sales_day",
        type: "chart",
        title: "Movimiento diario",
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
        id: "chart_collections_status",
        type: "chart",
        title: "Estado de las cuotas",
        reportId: byApiName.get("collections_by_status")._id,
        chartType: "pie",
        xField: "status",
        series: ["balance_total"],
        size: "half",
      },
      {
        id: "table_top_products",
        type: "table",
        title: "Productos con mas salida",
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

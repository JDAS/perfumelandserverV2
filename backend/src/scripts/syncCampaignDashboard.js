const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ReportDefinition = require("../models/ReportDefinition");
const DashboardDefinition = require("../models/DashboardDefinition");

const metrics = [
  { id: "campaign_count", label: "Campañas", operation: "count", field: "*", format: "number" },
  { id: "sales_total", label: "Ventas generadas", operation: "sum", field: "sales_total", format: "currency" },
  { id: "paid_total", label: "Dinero cobrado", operation: "sum", field: "paid_total", format: "currency" },
  { id: "balance_due", label: "Saldo pendiente", operation: "sum", field: "balance_due", format: "currency" },
  { id: "gross_profit", label: "Ganancia bruta", operation: "sum", field: "gross_profit", format: "currency" },
  { id: "commission_generated", label: "Comisiones generadas", operation: "sum", field: "commission_generated", format: "currency" },
  { id: "commission_paid", label: "Comisiones pagadas", operation: "sum", field: "commission_paid", format: "currency" },
  { id: "expected_profit", label: "Ganancia esperada", operation: "sum", field: "expected_profit", format: "currency" },
  { id: "gross_margin", label: "Margen bruto", operation: "avg", field: "gross_margin", format: "percent" },
  { id: "expected_margin", label: "Margen esperado", operation: "avg", field: "expected_margin", format: "percent" },
  { id: "participants", label: "Participantes", operation: "sum", field: "participants", format: "number" },
  { id: "entries", label: "Acciones asignadas", operation: "sum", field: "entries", format: "number" },
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI no definido");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
  });

  const report = await ReportDefinition.findOneAndUpdate(
    { apiName: "campaign_performance" },
    {
      $set: {
        name: "Rendimiento por campaña",
        apiName: "campaign_performance",
        description: "Ingresos, cobros, costos, ganancia, participantes y acciones por campaña.",
        isActive: true,
        engine: "campaign_performance",
        sourceObject: "campaign",
        filters: [],
        groupBy: [],
        metrics,
        columns: [],
        sort: [],
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const widgets = [
    ["kpi_campaign_sales", "kpi", "Ventas generadas", "sales_total", "third"],
    ["kpi_campaign_paid", "kpi", "Dinero cobrado", "paid_total", "third"],
    ["kpi_campaign_profit", "kpi", "Ganancia esperada", "expected_profit", "third"],
    ["kpi_campaign_balance", "kpi", "Saldo pendiente", "balance_due", "third"],
    ["kpi_campaign_commissions", "kpi", "Comisiones generadas", "commission_generated", "third"],
    ["kpi_campaign_participants", "kpi", "Participantes", "participants", "third"],
  ].map(([id, type, title, metricId, size]) => ({
    id,
    type,
    title,
    reportId: report._id,
    metricId,
    size,
  }));

  widgets.push(
    {
      id: "chart_campaign_sales",
      type: "chart",
      title: "Ventas y ganancia por campaña",
      reportId: report._id,
      chartType: "bar",
      xField: "campaign_name",
      series: ["sales_total", "gross_profit", "expected_profit"],
      size: "full",
    },
    {
      id: "chart_campaign_entries",
      type: "chart",
      title: "Acciones asignadas por campaña",
      reportId: report._id,
      chartType: "bar",
      xField: "campaign_name",
      series: ["entries"],
      size: "half",
    },
    {
      id: "table_campaign_detail",
      type: "table",
      title: "Detalle financiero y operativo",
      reportId: report._id,
      columns: [
        "campaign_name",
        "status",
        "linked_sales",
        "participants",
        "entries",
        "entry_progress",
        "sales_total",
        "paid_total",
        "balance_due",
        "gross_profit",
        "commission_generated",
        "commission_paid",
        "expected_profit",
        "gross_margin",
        "expected_margin",
        "cost_coverage",
      ],
      size: "full",
    }
  );

  const dashboard = await DashboardDefinition.findOneAndUpdate(
    { apiName: "campaign_overview" },
    {
      $set: {
        name: "Campañas Perfumeland",
        apiName: "campaign_overview",
        description: "Resultados financieros y operativos actualizados por campaña.",
        isActive: true,
        widgets,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log(JSON.stringify({
    report: { id: report._id, name: report.name },
    dashboard: { id: dashboard._id, name: dashboard.name, widgets: widgets.length },
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

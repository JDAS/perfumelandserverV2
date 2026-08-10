const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ReportDefinition = require("../models/ReportDefinition");
const DashboardDefinition = require("../models/DashboardDefinition");

const sellerMetrics = [
  ["perfumes_sold", "Perfumes vendidos", "number"],
  ["sales_total", "Total vendido", "currency"],
  ["paid_total", "Total cobrado", "currency"],
  ["balance_due", "Saldo pendiente", "currency"],
  ["expected_earnings", "Ganancias esperadas", "currency"],
  ["real_earnings", "Ganancias reales", "currency"],
  ["commission_generated", "Comisiones", "currency"],
  ["sales_count", "Ventas", "number"],
].map(([id, label, format]) => ({ id, label, operation: "sum", field: id, format }));

const campaignMetrics = [
  ["campaign_count", "Campañas", "number"],
  ["linked_sales", "Ventas en campañas", "number"],
  ["sales_total", "Ventas por campaña", "currency"],
  ["paid_total", "Cobrado por campaña", "currency"],
  ["assigned_entries", "Acciones asignadas", "number"],
  ["commission_generated", "Comisiones", "currency"],
].map(([id, label, format]) => ({ id, label, operation: "sum", field: id, format }));

async function upsertReport(apiName, payload) {
  return ReportDefinition.findOneAndUpdate(
    { apiName },
    { $set: { apiName, isActive: true, filters: [], groupBy: [], columns: [], sort: [], ...payload } },
    { upsert: true, returnDocument: "after" }
  );
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI no definido");
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MIGRATION_TARGET_DB || "test" });

  const sellerReport = await upsertReport("seller_year_performance", {
    name: "Ventas anuales por vendedor",
    description: "Ventas, cobros, saldo y ganancias por vendedor con filtro anual.",
    engine: "seller_year_performance",
    sourceObject: "sales",
    metrics: sellerMetrics,
  });
  const campaignReport = await upsertReport("seller_campaign_performance", {
    name: "Participación por vendedor y campaña",
    description: "Aporte comercial y acciones asignadas por vendedor dentro de cada campaña.",
    engine: "seller_campaign_performance",
    sourceObject: "campaign_sale_link",
    metrics: campaignMetrics,
  });

  const widgets = [
    ["seller_sales", "Ventas", "sales_total"],
    ["seller_paid", "Cobrado", "paid_total"],
    ["seller_units", "Perfumes vendidos", "perfumes_sold"],
    ["seller_expected_profit", "Ganancia esperada", "expected_earnings"],
  ].map(([id, title, metricId]) => ({ id, type: "kpi", title, reportId: sellerReport._id, metricId, size: "third" }));

  widgets.push(
    { id: "seller_sales_chart", type: "chart", title: "Ventas y ganancias por vendedor", reportId: sellerReport._id, chartType: "bar", xField: "seller_id", series: ["sales_total", "expected_earnings", "real_earnings"], size: "full" },
    { id: "seller_detail", type: "table", title: "Detalle anual por vendedor", reportId: sellerReport._id, columns: ["seller_id", "perfumes_sold", "sales_count", "sales_total", "paid_total", "balance_due", "expected_earnings", "real_earnings", "commission_generated"], size: "full" },
    { id: "campaign_entries_chart", type: "chart", title: "Acciones por vendedor y campaña", reportId: campaignReport._id, chartType: "bar", xField: "campaign_name", series: ["assigned_entries"], size: "full" },
    { id: "campaign_seller_detail", type: "table", title: "Participación por campaña", reportId: campaignReport._id, columns: ["seller_id", "campaign_name", "campaign_status", "linked_sales", "sales_total", "paid_total", "participants", "assigned_entries", "commission_generated"], size: "full" }
  );

  const dashboard = await DashboardDefinition.findOneAndUpdate(
    { apiName: "seller_sales_overview" },
    { $set: { name: "Ventas por vendedor", apiName: "seller_sales_overview", description: "Desempeño anual y participación en campañas por vendedor.", isActive: true, widgets } },
    { upsert: true, returnDocument: "after" }
  );
  console.log(JSON.stringify({ dashboard: dashboard.name, widgets: widgets.length }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => { console.error(error); process.exit(1); });

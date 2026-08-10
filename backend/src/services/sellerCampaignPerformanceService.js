const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeYear(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : new Date().getFullYear();
}

function databaseIds(values) {
  return values.map((value) => mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value);
}

function buildSellerCampaignRows({ sales = [], sellers = [], campaigns = [], links = [], entries = [] }) {
  const saleById = new Map(sales.map((sale) => [String(sale._id), sale]));
  const sellerById = new Map(sellers.map((seller) => [String(seller._id), seller.name || "Sin vendedor"]));
  const campaignById = new Map(campaigns.map((campaign) => [String(campaign._id), campaign]));
  const entriesBySaleAndCampaign = new Map();

  for (const entry of entries) {
    const key = `${String(entry.sale_id || "")}:${String(entry.campaign_id || "")}`;
    entriesBySaleAndCampaign.set(key, (entriesBySaleAndCampaign.get(key) || 0) + 1);
  }

  const rows = new Map();
  const seenSales = new Set();
  for (const link of links) {
    if (link.status && link.status !== "Activa") continue;
    const saleId = String(link.sale_id || "");
    const campaignId = String(link.campaign_id || "");
    const sale = saleById.get(saleId);
    if (!sale || !campaignId) continue;

    const sellerId = String(sale.seller_id || "");
    const dedupeKey = `${sellerId}:${campaignId}:${saleId}`;
    if (seenSales.has(dedupeKey)) continue;
    seenSales.add(dedupeKey);

    const campaign = campaignById.get(campaignId) || {};
    const rowKey = `${sellerId}:${campaignId}`;
    const row = rows.get(rowKey) || {
      seller_id: sellerId,
      seller_id__label: sellerById.get(sellerId) || "Sin vendedor",
      campaign_id: campaignId,
      campaign_name: campaign.name || "Campaña sin nombre",
      campaign_status: campaign.status || "",
      linked_sales: 0,
      sales_total: 0,
      paid_total: 0,
      commission_generated: 0,
      assigned_entries: 0,
      participants: new Set(),
    };

    row.linked_sales += 1;
    row.sales_total += toNumber(sale.total);
    row.paid_total += toNumber(sale.total_paid);
    row.commission_generated += toNumber(sale.commission_amount);
    row.assigned_entries += entriesBySaleAndCampaign.get(`${saleId}:${campaignId}`) || 0;
    if (link.participant_id) row.participants.add(String(link.participant_id));
    rows.set(rowKey, row);
  }

  return [...rows.values()]
    .map((row) => ({ ...row, participants: row.participants.size }))
    .sort((left, right) => right.sales_total - left.sales_total);
}

async function executeSellerCampaignPerformanceReport(reportDefinition, options = {}) {
  const targetDb = mongoose.connection.useDb(TARGET_DB_NAME, { useCache: true });
  const year = normalizeYear(options.year);
  const sellerId = String(options.sellerId || "").trim();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const saleFilter = {
    status: "Completada",
    saledate: { $gte: startDate, $lte: endDate },
    seller_id: { $exists: true, $ne: "" },
  };
  if (sellerId) saleFilter.seller_id = sellerId;

  const sales = await targetDb.collection("sales").find(saleFilter).project({
    seller_id: 1,
    total: 1,
    total_paid: 1,
    commission_amount: 1,
  }).toArray();
  const saleIds = sales.map((sale) => String(sale._id));
  const links = saleIds.length
    ? await targetDb.collection("campaign_sale_link").find({ sale_id: { $in: saleIds } }).toArray()
    : [];
  const campaignIds = [...new Set(links.map((link) => String(link.campaign_id || "")).filter(Boolean))];
  const sellerIds = [...new Set(sales.map((sale) => String(sale.seller_id || "")).filter(Boolean))];
  const [sellers, campaigns, entries] = await Promise.all([
    sellerIds.length ? targetDb.collection("seller").find({ _id: { $in: databaseIds(sellerIds) } }).project({ name: 1 }).toArray() : [],
    campaignIds.length ? targetDb.collection("campaign").find({ _id: { $in: databaseIds(campaignIds) } }).project({ name: 1, status: 1 }).toArray() : [],
    saleIds.length ? targetDb.collection("campaign_entry").find({ sale_id: { $in: saleIds } }).project({ sale_id: 1, campaign_id: 1 }).toArray() : [],
  ]);
  const rows = buildSellerCampaignRows({ sales, sellers, campaigns, links, entries });

  return {
    viewType: "seller_campaign_performance",
    report: { _id: reportDefinition._id, name: reportDefinition.name, apiName: reportDefinition.apiName },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: "Participación de vendedores por campaña",
    period: { year, startDate, endDate, selectedSellerId: sellerId },
    columns: [
      { id: "seller_id", label: "Vendedor", type: "group" },
      { id: "campaign_name", label: "Campaña", type: "text" },
      { id: "linked_sales", label: "Ventas", type: "number" },
      { id: "sales_total", label: "Total vendido", type: "currency" },
      { id: "paid_total", label: "Total cobrado", type: "currency" },
      { id: "participants", label: "Participantes", type: "number" },
      { id: "assigned_entries", label: "Acciones asignadas", type: "number" },
      { id: "commission_generated", label: "Comisiones", type: "currency" },
    ],
    rows,
    summary: {
      campaign_count: new Set(rows.map((row) => row.campaign_id)).size,
      linked_sales: rows.reduce((sum, row) => sum + row.linked_sales, 0),
      sales_total: rows.reduce((sum, row) => sum + row.sales_total, 0),
      paid_total: rows.reduce((sum, row) => sum + row.paid_total, 0),
      assigned_entries: rows.reduce((sum, row) => sum + row.assigned_entries, 0),
      commission_generated: rows.reduce((sum, row) => sum + row.commission_generated, 0),
    },
  };
}

module.exports = { buildSellerCampaignRows, executeSellerCampaignPerformanceReport };

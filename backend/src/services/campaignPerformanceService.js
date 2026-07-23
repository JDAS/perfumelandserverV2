const { getCustomRecordModel } = require("../models/CustomRecord");

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function buildCampaignPerformanceRows({
  campaigns = [],
  links = [],
  participants = [],
  entries = [],
  sales = [],
  saleItems = [],
}) {
  const salesById = new Map(sales.map((sale) => [String(sale._id), sale]));
  const itemsBySaleId = new Map();

  for (const item of saleItems) {
    const saleId = String(item.sale || "");
    if (!saleId) continue;
    if (!itemsBySaleId.has(saleId)) itemsBySaleId.set(saleId, []);
    itemsBySaleId.get(saleId).push(item);
  }

  return campaigns.map((campaign) => {
    const campaignId = String(campaign._id);
    const campaignLinks = links.filter(
      (link) =>
        String(link.campaign_id || "") === campaignId &&
        String(link.status || "Activa") === "Activa"
    );
    const uniqueSaleIds = [
      ...new Set(campaignLinks.map((link) => String(link.sale_id || "")).filter(Boolean)),
    ];
    const campaignSales = uniqueSaleIds
      .map((saleId) => salesById.get(saleId))
      .filter((sale) => sale && String(sale.status) === "Completada");

    let salesTotal = 0;
    let paidTotal = 0;
    let costTotal = 0;
    let revenueWithKnownCost = 0;
    let commissionGenerated = 0;
    let commissionPaid = 0;
    let unitsSold = 0;

    for (const sale of campaignSales) {
      salesTotal += toNumber(sale.total);
      paidTotal += toNumber(sale.total_paid);
      commissionGenerated += toNumber(sale.commission_amount);
      if (sale.commission_paid === true) {
        commissionPaid += toNumber(sale.commission_amount);
      }

      for (const item of itemsBySaleId.get(String(sale._id)) || []) {
        const quantity = Math.max(toNumber(item.quantity), 0);
        const itemRevenue = toNumber(item.total);
        const unitCost = toNumber(item.cost_snapshot);
        unitsSold += quantity;
        if (unitCost > 0) {
          costTotal += unitCost * quantity;
          revenueWithKnownCost += itemRevenue;
        }
      }
    }

    const participantCount = participants.filter(
      (participant) =>
        String(participant.campaign_id || "") === campaignId &&
        String(participant.status || "Activo") === "Activo"
    ).length;
    const entryCount = entries.filter(
      (entry) =>
        String(entry.campaign_id || "") === campaignId &&
        String(entry.status || "Activa") === "Activa"
    ).length;
    const capacity =
      Math.max(toNumber(campaign.entry_end) - toNumber(campaign.entry_start) + 1, 0);
    const grossProfit = revenueWithKnownCost - costTotal;
    const expectedProfit = grossProfit - commissionGenerated;

    return {
      campaign_id: campaignId,
      campaign_name: campaign.name || "Campaña sin nombre",
      status: campaign.status || "",
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
      linked_sales: campaignSales.length,
      participants: participantCount,
      entries: entryCount,
      entry_capacity: capacity,
      entry_progress: capacity > 0 ? round((entryCount / capacity) * 100, 2) : 0,
      units_sold: unitsSold,
      sales_total: round(salesTotal),
      paid_total: round(paidTotal),
      balance_due: round(Math.max(salesTotal - paidTotal, 0)),
      cost_total: round(costTotal),
      revenue_with_known_cost: round(revenueWithKnownCost),
      gross_profit: round(grossProfit),
      commission_generated: round(commissionGenerated),
      commission_paid: round(commissionPaid),
      expected_profit: round(expectedProfit),
      gross_margin: revenueWithKnownCost > 0
        ? round((grossProfit / revenueWithKnownCost) * 100, 2)
        : 0,
      expected_margin: revenueWithKnownCost > 0
        ? round((expectedProfit / revenueWithKnownCost) * 100, 2)
        : 0,
      cost_coverage: salesTotal > 0
        ? round((revenueWithKnownCost / salesTotal) * 100, 2)
        : 0,
    };
  });
}

async function executeCampaignPerformanceReport(reportDefinition) {
  const Campaign = getCustomRecordModel("campaign");
  const Link = getCustomRecordModel("campaign_sale_link");
  const Participant = getCustomRecordModel("campaign_participant");
  const Entry = getCustomRecordModel("campaign_entry");
  const Sale = getCustomRecordModel("sales");
  const SaleItem = getCustomRecordModel("sale_item");

  const [campaigns, links, participants, entries] = await Promise.all([
    Campaign.find({}).sort({ start_date: -1 }).lean(),
    Link.find({}).lean(),
    Participant.find({}).lean(),
    Entry.find({}).lean(),
  ]);

  const saleIds = [...new Set(links.map((link) => String(link.sale_id || "")).filter(Boolean))];
  const [sales, saleItems] = saleIds.length
    ? await Promise.all([
        Sale.find({ _id: { $in: saleIds } }).lean(),
        SaleItem.find({ sale: { $in: saleIds } }).lean(),
      ])
    : [[], []];

  const rows = buildCampaignPerformanceRows({
    campaigns,
    links,
    participants,
    entries,
    sales,
    saleItems,
  });
  const summary = rows.reduce(
    (result, row) => {
      result.campaign_count += 1;
      result.linked_sales += row.linked_sales;
      result.participants += row.participants;
      result.entries += row.entries;
      result.sales_total += row.sales_total;
      result.paid_total += row.paid_total;
      result.balance_due += row.balance_due;
      result.cost_total += row.cost_total;
      result.revenue_with_known_cost += row.revenue_with_known_cost;
      result.gross_profit += row.gross_profit;
      result.commission_generated += row.commission_generated;
      result.commission_paid += row.commission_paid;
      result.expected_profit += row.expected_profit;
      return result;
    },
    {
      campaign_count: 0,
      linked_sales: 0,
      participants: 0,
      entries: 0,
      sales_total: 0,
      paid_total: 0,
      balance_due: 0,
      cost_total: 0,
      revenue_with_known_cost: 0,
      gross_profit: 0,
      commission_generated: 0,
      commission_paid: 0,
      expected_profit: 0,
    }
  );
  summary.gross_margin = summary.revenue_with_known_cost > 0
    ? round((summary.gross_profit / summary.revenue_with_known_cost) * 100, 2)
    : 0;
  summary.expected_margin = summary.revenue_with_known_cost > 0
    ? round((summary.expected_profit / summary.revenue_with_known_cost) * 100, 2)
    : 0;
  summary.cost_coverage = summary.sales_total > 0
    ? round((summary.revenue_with_known_cost / summary.sales_total) * 100, 2)
    : 0;

  return {
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: "campaign",
    sourceObjectLabel: "Campaña",
    totalSourceRecords: rows.length,
    columns: [
      { id: "campaign_name", label: "Campaña", type: "text" },
      { id: "status", label: "Estado", type: "text" },
      { id: "linked_sales", label: "Ventas", type: "number" },
      { id: "participants", label: "Participantes", type: "number" },
      { id: "entries", label: "Acciones", type: "number" },
      { id: "entry_progress", label: "Avance %", type: "number" },
      { id: "sales_total", label: "Ventas generadas", type: "currency" },
      { id: "paid_total", label: "Cobrado", type: "currency" },
      { id: "balance_due", label: "Pendiente", type: "currency" },
      { id: "gross_profit", label: "Ganancia bruta", type: "currency" },
      { id: "commission_generated", label: "Comisiones generadas", type: "currency" },
      { id: "commission_paid", label: "Comisiones pagadas", type: "currency" },
      { id: "expected_profit", label: "Ganancia esperada", type: "currency" },
      { id: "gross_margin", label: "Margen %", type: "number" },
      { id: "expected_margin", label: "Margen esperado %", type: "number" },
      { id: "cost_coverage", label: "Cobertura de costo %", type: "number" },
    ],
    rows,
    summary,
  };
}

module.exports = {
  buildCampaignPerformanceRows,
  executeCampaignPerformanceReport,
};

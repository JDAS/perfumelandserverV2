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

async function executeSellerYearPerformanceReport(reportDefinition, options = {}) {
  const targetDb = mongoose.connection.useDb(TARGET_DB_NAME, { useCache: true });
  const selectedYear = normalizeYear(options.year);
  const selectedSellerId = String(options.sellerId || "").trim();
  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;

  const salesFilter = {
    status: "Completada",
    saledate: { $gte: startDate, $lte: endDate },
    seller_id: { $exists: true, $ne: "" },
  };
  if (selectedSellerId) salesFilter.seller_id = selectedSellerId;

  const sales = await targetDb
    .collection("sales")
    .find(salesFilter)
    .project({
      seller_id: 1,
      total: 1,
      legacyEstimatedEarnings: 1,
      estimated_earnings: 1,
      legacyRealEarnings: 1,
      real_earnings: 1,
      commission_amount: 1,
      total_paid: 1,
      balance_due: 1,
    })
    .toArray();

  const saleIds = sales.map((sale) => String(sale._id));
  const saleItems = saleIds.length
    ? await targetDb
        .collection("sale_item")
        .find({
          sale: { $in: saleIds },
          sale_status: "Completada",
        })
        .project({
          sale: 1,
          quantity: 1,
          total: 1,
        })
        .toArray()
    : [];

  const sellerIds = [...new Set(sales.map((sale) => String(sale.seller_id)).filter(Boolean))];
  const sellers = sellerIds.length
    ? await targetDb.collection("seller").find({}).project({ name: 1 }).toArray()
    : [];

  const sellerNameById = new Map(
    sellers.map((seller) => [String(seller._id), seller.name || "Sin vendedor"])
  );

  const saleItemsBySaleId = new Map();
  for (const item of saleItems) {
    const saleId = String(item.sale);
    const current = saleItemsBySaleId.get(saleId) || {
      perfumesVendidos: 0,
      totalVendidoLineas: 0,
    };
    current.perfumesVendidos += toNumber(item.quantity);
    current.totalVendidoLineas += toNumber(item.total);
    saleItemsBySaleId.set(saleId, current);
  }

  const rowsBySeller = new Map();
  for (const sale of sales) {
    const sellerId = String(sale.seller_id);
    const sellerName = sellerNameById.get(sellerId) || "Sin vendedor";
    const lineTotals = saleItemsBySaleId.get(String(sale._id)) || {
      perfumesVendidos: 0,
      totalVendidoLineas: 0,
    };
    const current = rowsBySeller.get(sellerId) || {
      seller_id: sellerId,
      seller_id__label: sellerName,
      perfumes_sold: 0,
      sales_total: 0,
      expected_earnings: 0,
      real_earnings: 0,
      sales_count: 0,
      paid_total: 0,
      balance_due: 0,
      commission_generated: 0,
    };

    current.perfumes_sold += lineTotals.perfumesVendidos;
    current.sales_total += toNumber(sale.total) || lineTotals.totalVendidoLineas;
    current.expected_earnings +=
      toNumber(sale.legacyEstimatedEarnings) || toNumber(sale.estimated_earnings);
    current.real_earnings +=
      toNumber(sale.legacyRealEarnings) || toNumber(sale.real_earnings);
    current.sales_count += 1;
    current.paid_total += toNumber(sale.total_paid);
    current.balance_due += toNumber(sale.balance_due);
    current.commission_generated += toNumber(sale.commission_amount);
    rowsBySeller.set(sellerId, current);
  }

  const rows = [...rowsBySeller.values()].sort((left, right) => right.sales_total - left.sales_total);

  return {
    viewType: "seller_year_performance",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: "Ventas y ganancias por vendedor",
    totalSourceRecords: sales.length,
    period: {
      year: selectedYear,
      selectedSellerId,
      startDate,
      endDate,
    },
    columns: [
      { id: "seller_id", label: "Vendedor", type: "group" },
      { id: "perfumes_sold", label: "Perfumes vendidos", type: "metric", format: "number" },
      { id: "sales_total", label: "Total vendido", type: "metric", format: "currency" },
      { id: "expected_earnings", label: "Ganancias esperadas", type: "metric", format: "currency" },
      { id: "real_earnings", label: "Ganancias reales", type: "metric", format: "currency" },
      { id: "sales_count", label: "Ventas", type: "metric", format: "number" },
      { id: "paid_total", label: "Total cobrado", type: "metric", format: "currency" },
      { id: "balance_due", label: "Saldo pendiente", type: "metric", format: "currency" },
      { id: "commission_generated", label: "Comisiones", type: "metric", format: "currency" },
    ],
    rows,
    summary: {
      perfumes_sold: rows.reduce((sum, row) => sum + toNumber(row.perfumes_sold), 0),
      sales_total: rows.reduce((sum, row) => sum + toNumber(row.sales_total), 0),
      expected_earnings: rows.reduce((sum, row) => sum + toNumber(row.expected_earnings), 0),
      real_earnings: rows.reduce((sum, row) => sum + toNumber(row.real_earnings), 0),
      sales_count: rows.reduce((sum, row) => sum + toNumber(row.sales_count), 0),
      paid_total: rows.reduce((sum, row) => sum + toNumber(row.paid_total), 0),
      balance_due: rows.reduce((sum, row) => sum + toNumber(row.balance_due), 0),
      commission_generated: rows.reduce((sum, row) => sum + toNumber(row.commission_generated), 0),
    },
  };
}

module.exports = {
  executeSellerYearPerformanceReport,
};

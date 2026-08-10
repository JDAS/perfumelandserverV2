const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";
const SOURCE_DB_NAME = process.env.MIGRATION_SOURCE_DB || "perfumeland";
const INITIAL_BUDGET = Number(process.env.FINANCIAL_INITIAL_BUDGET) || 130000;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatPercent(value) {
  return `${round(value, 2).toFixed(2)}%`;
}

function calculateCashAndProfitability(input = {}) {
  const initialBudget = toNumber(input.initialBudget);
  const totalReceived = toNumber(input.totalReceived);
  const inventoryPurchases = toNumber(input.inventoryPurchases);
  const paidCommissions = toNumber(input.paidCommissions);
  const expenses = toNumber(input.expenses);
  const paidBonuses = toNumber(input.paidBonuses);
  const outstandingLoans = toNumber(input.outstandingLoans);
  const salesTotal = toNumber(input.salesTotal);
  const accountsReceivable = toNumber(input.accountsReceivable);
  const revenueWithKnownCost = toNumber(input.revenueWithKnownCost);
  const costOfGoodsSold = toNumber(input.costOfGoodsSold);
  const generatedCommissions = toNumber(input.generatedCommissions);

  const cashOutflows = inventoryPurchases + paidCommissions + expenses + paidBonuses;
  const availableCash = initialBudget + totalReceived - cashOutflows - outstandingLoans;
  const grossProfit = revenueWithKnownCost - costOfGoodsSold;
  const expectedProfit = grossProfit - generatedCommissions - expenses - paidBonuses;
  const costCoverage = salesTotal > 0 ? (revenueWithKnownCost / salesTotal) * 100 : 0;
  const expectedMargin = revenueWithKnownCost > 0
    ? (expectedProfit / revenueWithKnownCost) * 100
    : 0;

  return {
    initialBudget,
    totalReceived,
    inventoryPurchases,
    paidCommissions,
    expenses,
    paidBonuses,
    outstandingLoans,
    cashOutflows,
    availableCash,
    salesTotal,
    accountsReceivable,
    revenueWithKnownCost,
    costOfGoodsSold,
    generatedCommissions,
    grossProfit,
    expectedProfit,
    costCoverage,
    expectedMargin,
  };
}

async function aggregateSingle(collection, pipeline) {
  const result = await collection.aggregate(pipeline).toArray();
  return result[0] || {};
}

async function getOutstandingLoans(targetDb, sourceDb) {
  const targetCount = await targetDb.collection("loans").countDocuments().catch(() => 0);
  const loanDb = targetCount > 0 ? targetDb : sourceDb;
  const loans = await loanDb.collection("loans").find({}).toArray().catch(() => []);
  return loans.reduce((sum, loan) => {
    const paid = Array.isArray(loan.payments)
      ? loan.payments.reduce((paymentSum, payment) => paymentSum + toNumber(payment.amount), 0)
      : 0;
    return sum + Math.max(toNumber(loan.amount) - paid, 0);
  }, 0);
}

async function executeCashProfitabilityReport(reportDefinition) {
  const defaultConn = mongoose.connection;
  const targetDb = defaultConn.useDb(TARGET_DB_NAME, { useCache: true });
  const sourceDb = SOURCE_DB_NAME === TARGET_DB_NAME
    ? targetDb
    : defaultConn.useDb(SOURCE_DB_NAME, { useCache: true });

  const [saleItems, sales, stock, expenseTotals, bonusTotals, outstandingLoans] =
    await Promise.all([
      aggregateSingle(targetDb.collection("sale_item"), [
        { $match: { sale_status: { $ne: "Cancelada" } } },
        {
          $group: {
            _id: null,
            salesTotal: { $sum: { $ifNull: ["$total", 0] } },
            revenueWithKnownCost: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ["$cost_snapshot", null] }, null] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            costOfGoodsSold: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$cost_snapshot", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
          },
        },
      ]),
      aggregateSingle(targetDb.collection("sales"), [
        { $match: { status: { $ne: "Cancelada" } } },
        {
          $group: {
            _id: null,
            totalReceived: { $sum: { $ifNull: ["$total_paid", 0] } },
            accountsReceivable: { $sum: { $ifNull: ["$balance_due", 0] } },
            generatedCommissions: {
              $sum: { $ifNull: ["$legacyCommissionAmount", { $ifNull: ["$commission_amount", 0] }] },
            },
            paidCommissions: {
              $sum: {
                $cond: [
                  { $eq: [{ $ifNull: ["$legacyCommissionPaid", { $ifNull: ["$commission_paid", false] }] }, true] },
                  { $ifNull: ["$legacyCommissionAmount", { $ifNull: ["$commission_amount", 0] }] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      aggregateSingle(targetDb.collection("stock"), [
        { $match: { legacy_inventory_seed: { $ne: true } } },
        {
          $group: {
            _id: null,
            inventoryPurchases: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$wholesaleprice", 0] },
                  { $ifNull: ["$purchased", 0] },
                ],
              },
            },
          },
        },
      ]),
      aggregateSingle(targetDb.collection("expenses"), [
        { $group: { _id: null, expenses: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]),
      aggregateSingle(targetDb.collection("seller_bonus"), [
        { $match: { status: "Pagado" } },
        { $group: { _id: null, paidBonuses: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]).catch(() => ({})),
      getOutstandingLoans(targetDb, sourceDb),
    ]);

  const values = calculateCashAndProfitability({
    initialBudget: INITIAL_BUDGET,
    totalReceived: sales.totalReceived,
    inventoryPurchases: stock.inventoryPurchases,
    paidCommissions: sales.paidCommissions,
    expenses: expenseTotals.expenses,
    paidBonuses: bonusTotals.paidBonuses,
    outstandingLoans,
    salesTotal: saleItems.salesTotal,
    accountsReceivable: sales.accountsReceivable,
    revenueWithKnownCost: saleItems.revenueWithKnownCost,
    costOfGoodsSold: saleItems.costOfGoodsSold,
    generatedCommissions: sales.generatedCommissions,
  });

  const metrics = [
    ["available_cash", "Caja disponible", values.availableCash, "currency"],
    ["initial_budget", "Presupuesto inicial", values.initialBudget, "currency"],
    ["total_received", "Cobros recibidos", values.totalReceived, "currency"],
    ["cash_outflows", "Salidas de caja", values.cashOutflows, "currency"],
    ["inventory_purchases", "Compras de inventario", values.inventoryPurchases, "currency"],
    ["paid_commissions", "Comisiones pagadas", values.paidCommissions, "currency"],
    ["expenses", "Gastos adicionales", values.expenses, "currency"],
    ["paid_bonuses", "Bonos pagados", values.paidBonuses, "currency"],
    ["outstanding_loans", "Prestamos pendientes", values.outstandingLoans, "currency"],
    ["sales_total", "Total vendido", values.salesTotal, "currency"],
    ["accounts_receivable", "Cuentas por cobrar", values.accountsReceivable, "currency"],
    ["cost_of_goods_sold", "Costo de lo vendido", values.costOfGoodsSold, "currency"],
    ["gross_profit", "Ganancia bruta", values.grossProfit, "currency"],
    ["generated_commissions", "Comisiones generadas", values.generatedCommissions, "currency"],
    ["expected_profit", "Ganancia esperada", values.expectedProfit, "currency"],
    ["cost_coverage", "Cobertura de costos", values.costCoverage, "percent"],
    ["expected_margin", "Margen esperado", values.expectedMargin, "percent"],
  ].map(([id, label, value, format]) => ({
    id,
    label,
    value: round(value, format === "percent" ? 2 : 0),
    formatted: format === "percent" ? formatPercent(value) : formatCurrency(value),
    format,
  }));

  return {
    viewType: "financial_summary",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: "Caja y rentabilidad",
    totalSourceRecords: 0,
    columns: [
      { id: "metric", label: "Metrica", type: "text" },
      { id: "value", label: "Valor", type: "text" },
    ],
    rows: metrics.map((metric) => ({
      metric: metric.label,
      value: metric.formatted,
      metric_id: metric.id,
      raw_value: metric.value,
      format: metric.format,
    })),
    summary: values,
    metrics,
    notes: [
      "Caja disponible = presupuesto inicial + cobros - compras - comisiones pagadas - gastos - bonos pagados - prestamos pendientes.",
      "Ganancia esperada = ingresos con costo conocido - costo de lo vendido - comisiones generadas - gastos - bonos.",
      "El costo de lo vendido mide rentabilidad y no se vuelve a restar de la caja.",
      "Las ventas a credito aumentan cuentas por cobrar; solo sus pagos aumentan la caja.",
    ],
  };
}

module.exports = {
  calculateCashAndProfitability,
  executeCashProfitabilityReport,
};

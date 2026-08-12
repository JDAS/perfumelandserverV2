const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function calculateCashAvailable(values = {}) {
  const inflows = Math.round(toNumber(values.collectedSales) + toNumber(values.contributions) + toNumber(values.incomingAdjustments));
  const outflows = Math.round(
    toNumber(values.inventoryPurchases) +
    toNumber(values.paidCommissions) +
    toNumber(values.paidExpenses) +
    toNumber(values.paidBonuses) +
    toNumber(values.withdrawals) +
    toNumber(values.outgoingAdjustments)
  );
  return { inflows, outflows, available: inflows - outflows };
}

async function sumCollection(collection, records, valueFn) {
  const rows = await collection.find(records).toArray().catch(() => []);
  return rows.reduce((sum, row) => sum + toNumber(valueFn(row)), 0);
}

async function executeCashAvailableReport(reportDefinition) {
  const db = mongoose.connection.useDb(TARGET_DB_NAME, { useCache: true });
  const completedSales = await db.collection("sales").find({ status: "Completada" }).toArray();
  const collectedSales = completedSales.reduce((sum, sale) => sum + toNumber(sale.total_paid), 0);
  const accountsReceivable = completedSales.reduce((sum, sale) => sum + Math.max(toNumber(sale.balance_due), 0), 0);

  const [inventoryPurchases, paidExpenses, paidBonuses, cashMovements] = await Promise.all([
    sumCollection(db.collection("stock"), { purchased: { $gt: 0 } }, (row) => toNumber(row.purchased) * toNumber(row.wholesaleprice)),
    sumCollection(db.collection("expenses"), { status: "Pagado" }, (row) => row.amount),
    sumCollection(db.collection("seller_bonus"), { status: "Pagado" }, (row) => row.amount),
    db.collection("cash_movement").find({ status: "Confirmado" }).toArray().catch(() => []),
  ]);

  const paidCommissions = completedSales.reduce((sum, sale) => {
    const paid = sale.legacyCommissionPaid ?? sale.commission_paid;
    const amount = sale.legacyCommissionAmount ?? sale.commission_amount;
    return sum + (paid === true ? toNumber(amount) : 0);
  }, 0);

  const movementTotal = (type) => cashMovements
    .filter((movement) => movement.type === type)
    .reduce((sum, movement) => sum + Math.max(toNumber(movement.amount), 0), 0);
  const contributions = movementTotal("Aporte");
  const withdrawals = movementTotal("Retiro");
  const incomingAdjustments = movementTotal("Ajuste entrada");
  const outgoingAdjustments = movementTotal("Ajuste salida");
  const position = calculateCashAvailable({
    collectedSales,
    contributions,
    incomingAdjustments,
    inventoryPurchases,
    paidCommissions,
    paidExpenses,
    paidBonuses,
    withdrawals,
    outgoingAdjustments,
  });

  const metrics = [
    ["saldo_inicial", "Saldo inicial de caja", 0],
    ["cobros_ventas", "Cobros de ventas completadas", collectedSales],
    ["aportes", "Aportes de caja", contributions],
    ["ajustes_entrada", "Ajustes de entrada", incomingAdjustments],
    ["total_entradas", "Total entradas", position.inflows],
    ["compras_inventario", "Compras de inventario", inventoryPurchases],
    ["comisiones_pagadas", "Comisiones pagadas", paidCommissions],
    ["gastos_pagados", "Gastos pagados", paidExpenses],
    ["bonos_pagados", "Bonos pagados", paidBonuses],
    ["retiros", "Retiros de caja", withdrawals],
    ["ajustes_salida", "Ajustes de salida", outgoingAdjustments],
    ["total_salidas", "Total salidas", position.outflows],
    ["caja_disponible", "Caja disponible para compras", position.available],
    ["en_calle", "Por cobrar (no es efectivo)", accountsReceivable],
  ].map(([id, label, value]) => ({ id, label, value, formatted: formatCurrency(value), format: "currency" }));

  return {
    viewType: "financial_summary",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: "Caja disponible",
    totalSourceRecords: cashMovements.length,
    columns: [
      { id: "metric", label: "Metrica", type: "text" },
      { id: "value", label: "Valor", type: "text" },
    ],
    rows: metrics.map((metric) => ({ metric: metric.label, value: metric.formatted, metric_id: metric.id, raw_value: metric.value, format: metric.format })),
    summary: { ...position, accounts_receivable: accountsReceivable, movements: cashMovements.length },
    metrics,
    notes: [
      "La caja inicia en cero porque el presupuesto inicial ya fue retirado.",
      "Solo se cuentan cobros de ventas completadas; lo pendiente en calle no es efectivo disponible.",
      "Las compras descuentan el costo completo al registrarse, incluyendo productos ya vendidos y productos aun en stock.",
      "Usa Movimientos de caja para registrar aportes, retiros y ajustes confirmados.",
    ],
  };
}

module.exports = { calculateCashAvailable, executeCashAvailableReport };

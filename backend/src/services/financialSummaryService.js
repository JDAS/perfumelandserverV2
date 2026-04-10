const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";
const SOURCE_DB_NAME = process.env.MIGRATION_SOURCE_DB || "perfumeland";
const INITIAL_BUDGET = Number(process.env.FINANCIAL_INITIAL_BUDGET) || 130000;

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

function formatPercent(value) {
  return `${toNumber(value).toFixed(2)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CR").format(toNumber(value));
}

function getCurrentQuincenaDate() {
  const today = new Date();
  if (today.getDate() < 15) {
    return new Date(today.getFullYear(), today.getMonth(), 15);
  }
  return new Date(today.getFullYear(), today.getMonth() + 1, 0);
}

function sameUtcDay(left, right) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime())) return false;
  if (!(right instanceof Date) || Number.isNaN(right.getTime())) return false;
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

async function aggregateSingle(collection, pipeline) {
  const result = await collection.aggregate(pipeline).toArray();
  return result[0] || {};
}

async function getOutstandingLoans(targetDb, sourceDb) {
  const targetLoansCount = await targetDb.collection("loans").countDocuments().catch(() => 0);
  const loanSource = targetLoansCount > 0 ? targetDb : sourceDb;

  const loans = await loanSource.collection("loans").find({}).toArray().catch(() => []);
  return loans.reduce((sum, loan) => {
    const baseAmount = toNumber(loan.amount);
    const paidAmount = Array.isArray(loan.payments)
      ? loan.payments.reduce((paymentSum, payment) => paymentSum + toNumber(payment.amount), 0)
      : 0;
    return sum + (baseAmount - paidAmount);
  }, 0);
}

async function getInventoryPurchaseTotal(targetDb, sourceDb) {
  const stockTotals = await aggregateSingle(targetDb.collection("stock"), [
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $multiply: [
              { $ifNull: ["$wholesaleprice", 0] },
              { $ifNull: ["$purchased", 0] },
            ],
          },
        },
      },
    },
  ]);

  const stockTotal = toNumber(stockTotals.total);
  if (stockTotal > 0) return stockTotal;

  const legacyInventoryTotals = await aggregateSingle(sourceDb.collection("inventory"), [
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $multiply: [
              { $ifNull: ["$wholesalePrice", 0] },
              { $ifNull: ["$quantity", 0] },
            ],
          },
        },
      },
    },
  ]).catch(() => ({}));

  return toNumber(legacyInventoryTotals.total);
}

async function executeFinancialSummaryReport(reportDefinition) {
  const defaultConn = mongoose.connection;
  const targetDb = defaultConn.useDb(TARGET_DB_NAME, { useCache: true });
  const sourceDb =
    SOURCE_DB_NAME === TARGET_DB_NAME
      ? targetDb
      : defaultConn.useDb(SOURCE_DB_NAME, { useCache: true });

  const saleItemTotals = await aggregateSingle(targetDb.collection("sale_item"), [
    {
      $match: {
        sale_status: { $ne: "Cancelada" },
      },
    },
    {
      $group: {
        _id: null,
        pagosPerfumes: {
          $sum: {
            $multiply: [
              { $ifNull: ["$cost_snapshot", 0] },
              { $ifNull: ["$quantity", 0] },
            ],
          },
        },
        totalVendidos: { $sum: { $ifNull: ["$quantity", 0] } },
      },
    },
  ]);

  const salesTotals = await aggregateSingle(targetDb.collection("sales"), [
    {
      $group: {
        _id: null,
        totalRecibido: { $sum: { $ifNull: ["$total_paid", 0] } },
        enCalle: { $sum: { $ifNull: ["$balance_due", 0] } },
        pagosComisiones: {
          $sum: {
            $cond: [
              {
                $eq: [
                  {
                    $ifNull: ["$legacyCommissionPaid", { $ifNull: ["$commission_paid", false] }],
                  },
                  true,
                ],
              },
              { $ifNull: ["$legacyCommissionAmount", { $ifNull: ["$commission_amount", 0] }] },
              0,
            ],
          },
        },
        gananciasEsperadasBase: {
          $sum: {
            $ifNull: ["$legacyEstimatedEarnings", { $ifNull: ["$estimated_earnings", 0] }],
          },
        },
        gananciasReales: {
          $sum: {
            $ifNull: ["$legacyRealEarnings", { $ifNull: ["$real_earnings", 0] }],
          },
        },
      },
    },
  ]);

  const expensesTotals = await aggregateSingle(targetDb.collection("expenses"), [
    {
      $group: {
        _id: null,
        gastosAdicionales: { $sum: { $ifNull: ["$amount", 0] } },
      },
    },
  ]);

  const sellerBonusTotals = await aggregateSingle(targetDb.collection("seller_bonus"), [
    {
      $match: {
        status: "Pagado",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$amount", 0] } },
      },
    },
  ]).catch(() => ({}));

  const firstPaymentPendingTotals = await aggregateSingle(targetDb.collection("payment_plan"), [
    {
      $match: {
        installment_number: 1,
        status: { $in: ["Pending", "Partial", "Overdue"] },
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $subtract: [
              { $ifNull: ["$planned_amount", 0] },
              { $ifNull: ["$paid_amount", 0] },
            ],
          },
        },
      },
    },
  ]);

  const currentQuincena = getCurrentQuincenaDate();
  const quincenaPlans = await targetDb
    .collection("payment_plan")
    .find({
      status: { $in: ["Pending", "Partial", "Overdue"] },
      due_date: { $exists: true, $ne: "" },
    })
    .project({ due_date: 1, remaining_amount: 1, planned_amount: 1, paid_amount: 1 })
    .toArray();

  const proximaQuincena = quincenaPlans.reduce((sum, item) => {
    const dueDate = item?.due_date ? new Date(item.due_date) : null;
    const remainingAmount =
      item?.remaining_amount !== undefined && item?.remaining_amount !== null
        ? toNumber(item.remaining_amount)
        : Math.max(toNumber(item.planned_amount) - toNumber(item.paid_amount), 0);
    return sameUtcDay(dueDate, currentQuincena) ? sum + remainingAmount : sum;
  }, 0);

  const presupuestoInicial = INITIAL_BUDGET;
  const pagosPerfumes = toNumber(saleItemTotals.pagosPerfumes);
  const pagoInventario = await getInventoryPurchaseTotal(targetDb, sourceDb);
  const pagosComisiones = toNumber(salesTotals.pagosComisiones);
  const gastosAdicionales = toNumber(expensesTotals.gastosAdicionales);
  const bonosVendedores = toNumber(sellerBonusTotals.total);
  const totalPagos =
    pagosPerfumes + pagosComisiones + gastosAdicionales + pagoInventario + bonosVendedores;
  const totalRecibido = toNumber(salesTotals.totalRecibido);
  const enCalle = toNumber(salesTotals.enCalle);
  const outstandingLoans = await getOutstandingLoans(targetDb, sourceDb);
  const gananciasEsperadas =
    toNumber(salesTotals.gananciasEsperadasBase) - gastosAdicionales;
  const gananciasReales = toNumber(salesTotals.gananciasReales);
  const presupuestoActual = totalRecibido - totalPagos - outstandingLoans;
  const porcentajeGanancias = totalPagos > 0 ? (gananciasEsperadas / totalPagos) * 100 : 0;
  const diferenciaGastos = totalRecibido - totalPagos;
  const promedioGanancia =
    toNumber(saleItemTotals.totalVendidos) > 0
      ? gananciasEsperadas / toNumber(saleItemTotals.totalVendidos)
      : 0;
  const primerPagoPendiente = toNumber(firstPaymentPendingTotals.total);
  const totalVendidos = toNumber(saleItemTotals.totalVendidos);

  const metrics = [
    {
      id: "presupuesto_inicial",
      label: "Presupuesto inicial",
      value: presupuestoInicial,
      formatted: formatCurrency(presupuestoInicial),
      format: "currency",
    },
    {
      id: "pagos_perfumes",
      label: "Pagos de perfumes",
      value: pagosPerfumes,
      formatted: formatCurrency(pagosPerfumes),
      format: "currency",
    },
    {
      id: "pagos_comisiones",
      label: "Pagos comisiones",
      value: pagosComisiones,
      formatted: formatCurrency(pagosComisiones),
      format: "currency",
    },
    {
      id: "gastos_adicionales",
      label: "Gastos adicionales",
      value: gastosAdicionales,
      formatted: formatCurrency(gastosAdicionales),
      format: "currency",
    },
    {
      id: "bonos_vendedores",
      label: "Bonos vendedores",
      value: bonosVendedores,
      formatted: formatCurrency(bonosVendedores),
      format: "currency",
    },
    {
      id: "total_pagos",
      label: "Total pagos",
      value: totalPagos,
      formatted: formatCurrency(totalPagos),
      format: "currency",
    },
    {
      id: "total_recibido",
      label: "Total recibido",
      value: totalRecibido,
      formatted: formatCurrency(totalRecibido),
      format: "currency",
    },
    {
      id: "en_calle",
      label: "En calle",
      value: enCalle,
      formatted: formatCurrency(enCalle),
      format: "currency",
    },
    {
      id: "ganancias_esperadas",
      label: "Ganancias esperadas",
      value: gananciasEsperadas,
      formatted: formatCurrency(gananciasEsperadas),
      format: "currency",
    },
    {
      id: "ganancias_reales",
      label: "Ganancias reales",
      value: gananciasReales,
      formatted: formatCurrency(gananciasReales),
      format: "currency",
    },
    {
      id: "presupuesto_actual",
      label: "Presupuesto actual",
      value: presupuestoActual,
      formatted: formatCurrency(presupuestoActual),
      format: "currency",
    },
    {
      id: "porcentaje_ganancias",
      label: "Porcentaje ganancias",
      value: porcentajeGanancias,
      formatted: formatPercent(porcentajeGanancias),
      format: "percent",
    },
    {
      id: "diferencia_gastos",
      label: "Diferencia gastos",
      value: diferenciaGastos,
      formatted: formatCurrency(diferenciaGastos),
      format: "currency",
    },
    {
      id: "proxima_quincena",
      label: "Proxima quincena",
      value: proximaQuincena,
      formatted: formatCurrency(proximaQuincena),
      format: "currency",
    },
    {
      id: "promedio_ganancia",
      label: "Promedio de ganancia",
      value: promedioGanancia,
      formatted: formatCurrency(promedioGanancia),
      format: "currency",
    },
    {
      id: "primer_pago_pendiente",
      label: "Primer pago pendiente",
      value: primerPagoPendiente,
      formatted: formatCurrency(primerPagoPendiente),
      format: "currency",
    },
    {
      id: "total_vendidos",
      label: "Total vendidos",
      value: totalVendidos,
      formatted: formatNumber(totalVendidos),
      format: "number",
    },
  ];

  return {
    viewType: "financial_summary",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: "Resumen financiero especial",
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
    summary: {
      presupuesto_inicial: presupuestoInicial,
      total_pagos: totalPagos,
      total_recibido: totalRecibido,
      en_calle: enCalle,
      primer_pago_pendiente: primerPagoPendiente,
      total_vendidos: totalVendidos,
    },
    metrics,
    notes: [
      "Pagos de perfumes se calcula desde cost_snapshot en sale_item.",
      "Total pagos incluye compras actuales registradas en stock.",
      "Presupuesto actual descuenta prestamos pendientes cuando existen.",
    ],
  };
}

module.exports = {
  executeFinancialSummaryReport,
};

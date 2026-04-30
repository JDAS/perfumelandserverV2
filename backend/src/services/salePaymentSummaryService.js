const { getCustomRecordModel } = require("../models/CustomRecord");

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCRC(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDateOnly(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getPlanPendingAmount(plan) {
  if (plan.remaining_amount !== undefined && plan.remaining_amount !== null) {
    return Math.max(toNumber(plan.remaining_amount), 0);
  }

  return Math.max(toNumber(plan.planned_amount) - toNumber(plan.paid_amount), 0);
}

function buildWhatsappText(summary) {
  const lines = [
    "Resumen de Perfumes",
    "",
    ...summary.products.map((product) => `- ${product.name}`),
    "",
    `Total: ${summary.totalSaleFormatted}`,
    `Pagado: ${summary.totalPaidFormatted}`,
    `Pendiente: ${summary.balanceDueFormatted}`,
  ];

  if (summary.overdueTotal > 0) {
    lines.push(`En mora: ${summary.overdueTotalFormatted}`);
  }

  if (summary.overduePayments.length) {
    lines.push("", "Cuotas vencidas:");
    summary.overduePayments.forEach((payment) => {
      lines.push(
        `cuota #${payment.number}/${payment.dueDate}, monto: ${payment.pendingAmountFormatted}`
      );
    });
  }

  if (summary.nextPayment) {
    lines.push(
      "",
      "Próximo pago:",
      `cuota #${summary.nextPayment.number}/${summary.nextPayment.dueDate}, monto: ${summary.nextPayment.pendingAmountFormatted}`
    );
  }

  return lines.join("\n");
}

async function buildSalePaymentSummary(saleId) {
  const SalesModel = getCustomRecordModel("sales");
  const SaleItemModel = getCustomRecordModel("sale_item");
  const ProductModel = getCustomRecordModel("product");
  const PaymentPlanModel = getCustomRecordModel("payment_plan");

  const sale = await SalesModel.findById(saleId).lean();
  if (!sale) {
    const error = new Error("Venta no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const [items, plans] = await Promise.all([
    SaleItemModel.find({ sale: String(saleId) }).lean(),
    PaymentPlanModel.find({ sale_id: String(saleId) })
      .sort({ installment_number: 1, due_date: 1, _id: 1 })
      .lean(),
  ]);

  const productIds = [...new Set(items.map((item) => String(item.product || "")).filter(Boolean))];
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }).select("name").lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product.name || "Perfume"]));

  const summaryProducts = items.map((item) => {
    const quantity = toNumber(item.quantity) || 1;
    const name = productMap.get(String(item.product)) || item.product_name || "Perfume";

    return {
      id: String(item._id),
      name,
      quantity,
      originalPrice: toNumber(item.total),
      originalPriceFormatted: formatCRC(item.total),
      discountAmount: toNumber(item.discount),
      discountAmountFormatted: formatCRC(item.discount),
    };
  });

  const today = getTodayStart();
  const pendingPlans = plans
    .map((plan) => ({
      id: String(plan._id),
      number: plan.installment_number || "",
      dueDate: formatDateOnly(plan.due_date),
      dueDateRaw: plan.due_date ? new Date(plan.due_date) : null,
      plannedAmount: toNumber(plan.planned_amount),
      plannedAmountFormatted: formatCRC(plan.planned_amount),
      paidAmount: toNumber(plan.paid_amount),
      paidAmountFormatted: formatCRC(plan.paid_amount),
      pendingAmount: getPlanPendingAmount(plan),
      pendingAmountFormatted: formatCRC(getPlanPendingAmount(plan)),
      status: plan.status || "",
    }))
    .filter((plan) => plan.pendingAmount > 0);

  const overduePayments = pendingPlans.filter(
    (plan) => plan.dueDateRaw && plan.dueDateRaw < today
  );
  const nextPayment =
    pendingPlans.find((plan) => plan.dueDateRaw && plan.dueDateRaw >= today) ||
    pendingPlans[0] ||
    null;
  const overdueTotal = overduePayments.reduce((sum, plan) => sum + plan.pendingAmount, 0);
  const totalDiscounts = summaryProducts.reduce((sum, product) => sum + product.discountAmount, 0);

  const summary = {
    type: "sale_payment",
    title: `Resumen de próximos pagos - ${sale.name || "Venta"}`,
    recordId: String(sale._id),
    customerName: sale.name || "",
    products: summaryProducts,
    totalOriginal: toNumber(sale.total),
    totalOriginalFormatted: formatCRC(sale.total),
    totalDiscounts,
    totalDiscountsFormatted: formatCRC(totalDiscounts),
    totalSale: toNumber(sale.total),
    totalSaleFormatted: formatCRC(sale.total),
    totalPaid: toNumber(sale.total_paid),
    totalPaidFormatted: formatCRC(sale.total_paid),
    balanceDue: toNumber(sale.balance_due),
    balanceDueFormatted: formatCRC(sale.balance_due),
    overdueTotal,
    overdueTotalFormatted: formatCRC(overdueTotal),
    overduePayments,
    nextPayment,
    payments: pendingPlans,
    whatsappText: "",
  };

  summary.whatsappText = buildWhatsappText(summary);
  return summary;
}

module.exports = {
  buildSalePaymentSummary,
};

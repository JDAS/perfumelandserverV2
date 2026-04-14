const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");

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

function formatDateOnly(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function normalizeFilterDate(value) {
  const normalized = formatDateOnly(value);
  if (normalized) return normalized;
  return formatDateOnly(new Date());
}

async function executePaymentsByDayReport(reportDefinition, options = {}) {
  const targetDate = normalizeFilterDate(options.date);
  const PaymentModel = getCustomRecordModel("payment");
  const SalesModel = getCustomRecordModel("sales");
  const SellerModel = getCustomRecordModel("seller");
  const PaymentPlanModel = getCustomRecordModel("payment_plan");

  const objectDefinition = await CustomObject.findOne({ apiName: "payment" }).lean();
  if (!objectDefinition) {
    const error = new Error("Objeto fuente no encontrado: payment");
    error.statusCode = 404;
    throw error;
  }

  const payments = await PaymentModel.find({})
    .sort({ date: -1, createdAt: -1, _id: -1 })
    .lean();

  const filteredPayments = payments.filter(
    (payment) => formatDateOnly(payment.date || payment.createdAt) === targetDate
  );

  const saleIds = [
    ...new Set(filteredPayments.map((payment) => String(payment.sale_id || "")).filter(Boolean)),
  ];
  const paymentPlanIds = [
    ...new Set(
      filteredPayments.map((payment) => String(payment.payment_plan_id || "")).filter(Boolean)
    ),
  ];

  const sales = saleIds.length
    ? await SalesModel.find({ _id: { $in: saleIds } })
        .select("name seller_id")
        .lean()
    : [];

  const saleMap = new Map(sales.map((sale) => [String(sale._id), sale]));
  const sellerIds = [
    ...new Set(sales.map((sale) => String(sale.seller_id || "")).filter(Boolean)),
  ];

  const [sellers, paymentPlans] = await Promise.all([
    sellerIds.length
      ? SellerModel.find({ _id: { $in: sellerIds } }).select("name").lean()
      : [],
    paymentPlanIds.length
      ? PaymentPlanModel.find({ _id: { $in: paymentPlanIds } })
          .select("installment_number due_date")
          .lean()
      : [],
  ]);

  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller.name || "Sin vendedor"]));
  const paymentPlanMap = new Map(
    paymentPlans.map((plan) => [
      String(plan._id),
      {
        installmentNumber: plan.installment_number,
        dueDate: formatDateOnly(plan.due_date),
      },
    ])
  );

  const rows = filteredPayments.map((payment) => {
    const sale = saleMap.get(String(payment.sale_id || ""));
    const sellerName = sale?.seller_id
      ? sellerMap.get(String(sale.seller_id)) || "Sin vendedor"
      : "Sin vendedor";
    const plan = paymentPlanMap.get(String(payment.payment_plan_id || ""));

    return {
      payment_id: String(payment._id),
      date: formatDateOnly(payment.date || payment.createdAt),
      customer_name: sale?.name || "Sin referencia",
      sale_id: String(payment.sale_id || ""),
      sale_id__label: sale?.name || String(payment.sale_id || ""),
      seller_name: sellerName,
      payment_plan_label: plan?.installmentNumber
        ? `Cuota ${plan.installmentNumber}${plan.dueDate ? ` · ${plan.dueDate}` : ""}`
        : "-",
      amount: toNumber(payment.amount),
      amount_formatted: formatCurrency(payment.amount),
    };
  });

  const totalAmount = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);

  return {
    viewType: "payments_by_day",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: objectDefinition.name,
    totalSourceRecords: filteredPayments.length,
    filterDate: targetDate,
    columns: [
      { id: "date", label: "Fecha", type: "date" },
      { id: "customer_name", label: "Cliente / referencia", type: "text" },
      { id: "seller_name", label: "Vendedor", type: "text" },
      { id: "payment_plan_label", label: "Cuota", type: "text" },
      { id: "amount_formatted", label: "Monto", type: "text" },
    ],
    rows,
    summary: {
      payments_count: rows.length,
      payments_total: totalAmount,
      payments_total_formatted: formatCurrency(totalAmount),
    },
  };
}

module.exports = {
  executePaymentsByDayReport,
};

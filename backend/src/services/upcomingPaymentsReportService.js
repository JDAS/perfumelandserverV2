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
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
    parsed.getDate()
  ).padStart(2, "0")}`;
}

function parseDateOnly(value) {
  const normalized = formatDateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeId(value) {
  return value ? String(value) : "";
}

function getPaymentBucket(dueDate, today) {
  if (!dueDate) return "upcoming";
  const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "week";
  return "upcoming";
}

function getBucketLabel(bucket) {
  if (bucket === "overdue") return "Vencido";
  if (bucket === "week") return "Esta semana";
  return "Proximo";
}

function normalizeStatusFilter(value) {
  const status = String(value || "all").trim().toLowerCase();
  return ["all", "overdue", "week", "upcoming"].includes(status) ? status : "all";
}

function buildWhatsappSummary(rows, summary, sellerName) {
  const lines = [
    `Proximos pagos${sellerName ? ` - ${sellerName}` : ""}`,
    `Vencidos: ${summary.overdue_count} | Esta semana: ${summary.week_count} | Pendiente: ${summary.pending_total_formatted}`,
    "",
  ];

  if (!rows.length) {
    lines.push("No hay pagos pendientes para este filtro.");
    return lines.join("\n");
  }

  rows.slice(0, 15).forEach((row) => {
    lines.push(
      `- ${row.client_name} | ${row.sale_name} | Cuota ${row.installment_number || "-"} | ${row.due_date || "-"} | ${row.remaining_amount_formatted}`
    );
  });

  return lines.join("\n");
}

async function executeUpcomingPaymentsReport(reportDefinition, options = {}) {
  const PaymentPlanModel = getCustomRecordModel("payment_plan");
  const SalesModel = getCustomRecordModel("sales");
  const SellerModel = getCustomRecordModel("seller");
  const ClientModel = getCustomRecordModel("client");

  const objectDefinition = await CustomObject.findOne({ apiName: "payment_plan" }).lean();
  if (!objectDefinition) {
    const error = new Error("Objeto fuente no encontrado: payment_plan");
    error.statusCode = 404;
    throw error;
  }

  const sellerId = normalizeId(options.sellerId);
  const statusFilter = normalizeStatusFilter(options.status);
  const dateFrom = parseDateOnly(options.dateFrom);
  const dateTo = parseDateOnly(options.dateTo);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const plans = await PaymentPlanModel.find({
    status: { $ne: "Paid" },
  })
    .sort({ due_date: 1, _id: 1 })
    .lean();

  const saleIds = [...new Set(plans.map((plan) => normalizeId(plan.sale_id)).filter(Boolean))];
  const sales = saleIds.length
    ? await SalesModel.find({ _id: { $in: saleIds } })
        .select("name client_id seller_id status total total_paid payment_status")
        .lean()
    : [];

  const saleMap = new Map(sales.map((sale) => [String(sale._id), sale]));
  const sellerIds = [...new Set(sales.map((sale) => normalizeId(sale.seller_id)).filter(Boolean))];
  const clientIds = [...new Set(sales.map((sale) => normalizeId(sale.client_id)).filter(Boolean))];

  const [sellers, clients] = await Promise.all([
    sellerIds.length ? SellerModel.find({ _id: { $in: sellerIds } }).select("name").lean() : [],
    clientIds.length ? ClientModel.find({ _id: { $in: clientIds } }).select("name phone").lean() : [],
  ]);

  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller.name || "Sin vendedor"]));
  const clientMap = new Map(clients.map((client) => [String(client._id), client]));
  const selectedSellerName = sellerId ? sellerMap.get(sellerId) || "" : "";

  const rows = plans
    .map((plan) => {
      const sale = saleMap.get(normalizeId(plan.sale_id));
      if (!sale) return null;
      if (String(sale.status || "").toLowerCase() === "borrador") return null;
      if (sellerId && normalizeId(sale.seller_id) !== sellerId) return null;

      const plannedAmount = toNumber(plan.planned_amount);
      const paidAmount = toNumber(plan.paid_amount);
      const remainingAmount = Math.max(plannedAmount - paidAmount, 0);
      const saleTotal = toNumber(sale.total);
      const salePaid = toNumber(sale.total_paid);
      const saleBalance = saleTotal > 0 ? Math.max(saleTotal - salePaid, 0) : remainingAmount;
      if (remainingAmount <= 0 || saleBalance <= 0) return null;

      const dueDate = parseDateOnly(plan.due_date);
      if (dateFrom && dueDate && dueDate < dateFrom) return null;
      if (dateTo && dueDate && dueDate > dateTo) return null;

      const bucket = getPaymentBucket(dueDate, today);
      if (statusFilter !== "all" && bucket !== statusFilter) return null;

      const client = clientMap.get(normalizeId(sale.client_id));

      return {
        payment_plan_id: String(plan._id),
        sale_id: normalizeId(sale._id),
        sale_name: sale.name || `Venta ${String(sale._id).slice(-6)}`,
        client_name: client?.name || "Sin cliente",
        client_phone: client?.phone || "",
        seller_id: normalizeId(sale.seller_id),
        seller_name: sellerMap.get(normalizeId(sale.seller_id)) || "Sin vendedor",
        installment_number: toNumber(plan.installment_number) || "",
        due_date: formatDateOnly(plan.due_date),
        planned_amount: plannedAmount,
        planned_amount_formatted: formatCurrency(plannedAmount),
        paid_amount: paidAmount,
        paid_amount_formatted: formatCurrency(paidAmount),
        remaining_amount: remainingAmount,
        remaining_amount_formatted: formatCurrency(remainingAmount),
        status_bucket: bucket,
        status_label: getBucketLabel(bucket),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDate = parseDateOnly(left.due_date)?.getTime() || 0;
      const rightDate = parseDateOnly(right.due_date)?.getTime() || 0;
      return leftDate - rightDate;
    });

  const pendingTotal = rows.reduce((sum, row) => sum + row.remaining_amount, 0);
  const summary = {
    rows_count: rows.length,
    overdue_count: rows.filter((row) => row.status_bucket === "overdue").length,
    week_count: rows.filter((row) => row.status_bucket === "week").length,
    upcoming_count: rows.filter((row) => row.status_bucket === "upcoming").length,
    pending_total: pendingTotal,
    pending_total_formatted: formatCurrency(pendingTotal),
  };

  return {
    viewType: "upcoming_payments",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: objectDefinition.name,
    totalSourceRecords: rows.length,
    filters: {
      sellerId,
      sellerName: selectedSellerName,
      status: statusFilter,
      dateFrom: formatDateOnly(options.dateFrom),
      dateTo: formatDateOnly(options.dateTo),
    },
    columns: [
      { id: "sale_name", label: "Venta", type: "text" },
      { id: "client_name", label: "Cliente", type: "text" },
      { id: "seller_name", label: "Vendedor", type: "text" },
      { id: "installment_number", label: "Cuota", type: "number" },
      { id: "due_date", label: "Fecha", type: "date" },
      { id: "status_label", label: "Estado", type: "text" },
      { id: "planned_amount_formatted", label: "Esperado", type: "text" },
      { id: "paid_amount_formatted", label: "Pagado", type: "text" },
      { id: "remaining_amount_formatted", label: "Pendiente", type: "text" },
    ],
    rows,
    summary: {
      ...summary,
      whatsapp_text: buildWhatsappSummary(rows, summary, selectedSellerName),
    },
  };
}

module.exports = {
  executeUpcomingPaymentsReport,
};

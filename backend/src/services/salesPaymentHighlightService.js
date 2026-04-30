const { getCustomRecordModel } = require("../models/CustomRecord");

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeIds(idsInput = "") {
  if (Array.isArray(idsInput)) {
    return idsInput.map((id) => String(id || "").trim()).filter(Boolean);
  }

  return String(idsInput || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getPendingAmount(plan = {}) {
  if (plan.remaining_amount !== undefined && plan.remaining_amount !== null) {
    return Math.max(toNumber(plan.remaining_amount), 0);
  }

  return Math.max(toNumber(plan.planned_amount) - toNumber(plan.paid_amount), 0);
}

async function buildSalesPaymentHighlights(idsInput) {
  const saleIds = normalizeIds(idsInput);
  if (!saleIds.length) return {};

  const SalesModel = getCustomRecordModel("sales");
  const PaymentPlanModel = getCustomRecordModel("payment_plan");
  const [sales, plans] = await Promise.all([
    SalesModel.find({ _id: { $in: saleIds } }).select("total total_paid balance_due").lean(),
    PaymentPlanModel.find({ sale_id: { $in: saleIds } })
      .select("sale_id installment_number due_date planned_amount paid_amount remaining_amount status")
      .lean(),
  ]);

  const today = getTodayStart();
  const soonLimit = new Date(today);
  soonLimit.setDate(soonLimit.getDate() + 3);
  const plansBySale = new Map();

  for (const plan of plans) {
    const saleId = String(plan.sale_id || "");
    if (!saleId) continue;
    if (!plansBySale.has(saleId)) plansBySale.set(saleId, []);
    plansBySale.get(saleId).push(plan);
  }

  return Object.fromEntries(
    sales.map((sale) => {
      const saleId = String(sale._id);
      const total = toNumber(sale.total);
      const totalPaid = toNumber(sale.total_paid);
      const balanceDue =
        sale.balance_due !== undefined && sale.balance_due !== null
          ? toNumber(sale.balance_due)
          : Math.max(total - totalPaid, 0);

      if (total > 0 && (totalPaid >= total || balanceDue <= 0)) {
        return [
          saleId,
          {
            status: "paid",
            label: "Pagada",
          },
        ];
      }

      const pendingPlans = (plansBySale.get(saleId) || [])
        .map((plan) => ({
          ...plan,
          pendingAmount: getPendingAmount(plan),
          dueDate: plan.due_date ? new Date(plan.due_date) : null,
        }))
        .filter((plan) => plan.pendingAmount > 0);

      const overduePlans = pendingPlans.filter(
        (plan) => plan.dueDate && !Number.isNaN(plan.dueDate.getTime()) && plan.dueDate < today
      );
      if (overduePlans.length > 0) {
        return [
          saleId,
          {
            status: "overdue",
            label: "En mora",
            count: overduePlans.length,
          },
        ];
      }

      const dueSoonPlans = pendingPlans.filter(
        (plan) =>
          plan.dueDate &&
          !Number.isNaN(plan.dueDate.getTime()) &&
          plan.dueDate >= today &&
          plan.dueDate <= soonLimit
      );
      if (dueSoonPlans.length > 0) {
        return [
          saleId,
          {
            status: "due_soon",
            label: "Cuota próxima",
            count: dueSoonPlans.length,
          },
        ];
      }

      return [
        saleId,
        {
          status: "open",
          label: "Pendiente",
        },
      ];
    })
  );
}

module.exports = {
  buildSalesPaymentHighlights,
};

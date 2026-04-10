const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";
const SOURCE_DB_NAME = process.env.MIGRATION_SOURCE_DB || "perfumeland";

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return Boolean(value);
}

function normalizeString(value) {
  return String(value || "").trim();
}

function inferPaymentPlanStatus({ expectedAmount, paidAmount, dueDate }) {
  const expected = Number(expectedAmount) || 0;
  const paid = Number(paidAmount) || 0;

  if (expected > 0 && paid >= expected) return "Paid";
  if (paid > 0) return "Partial";

  if (dueDate) {
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const due = new Date(dueDate);
    if (!Number.isNaN(due.getTime()) && due < localToday) {
      return "Overdue";
    }
  }

  return "Pending";
}

function inferSalePaymentStatus({ saleStatus, total, totalPaid }) {
  if (saleStatus === "Cancelada") return "Cancelada";
  if (saleStatus === "Borrador") return "Borrador";

  const safeTotal = Number(total) || 0;
  const safePaid = Number(totalPaid) || 0;

  if (safeTotal > 0 && safePaid >= safeTotal) return "Pagada";
  if (safePaid > 0) return "Parcial";
  return "Pendiente";
}

function allocateLegacyInstallments(legacySale) {
  const payments = Array.isArray(legacySale?.payments) ? legacySale.payments : [];
  let remainingPaid = Number(legacySale?.totalPaid) || 0;

  return payments.map((payment, index) => {
    const expectedAmount = Number(payment?.expectedAmount) || 0;
    const paidAmount = Math.min(expectedAmount, Math.max(remainingPaid, 0));

    remainingPaid = Math.max(remainingPaid - paidAmount, 0);

    return {
      paymentIndex: index,
      installmentNumber: Number(payment?.number) || index + 1,
      dueDate: normalizeString(payment?.fecha),
      expectedAmount,
      paidAmount,
    };
  });
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no esta configurado.");
  }

  const source = await mongoose.createConnection(process.env.MONGO_URI, {
    dbName: SOURCE_DB_NAME,
  }).asPromise();

  const target = await mongoose.createConnection(process.env.MONGO_URI, {
    dbName: TARGET_DB_NAME,
  }).asPromise();

  const legacySales = await source.collection("sales").find({}).toArray();

  let salesUpdated = 0;
  let plansUpdated = 0;
  let paymentsUpserted = 0;
  let paymentsDeleted = 0;

  for (const legacySale of legacySales) {
    const legacyId = String(legacySale._id);
    const targetSale = await target.collection("sales").findOne({ legacyId });
    if (!targetSale) continue;

    const allocations = allocateLegacyInstallments(legacySale);
    for (const allocation of allocations) {
      const status = inferPaymentPlanStatus(allocation);
      const planUpdate = {
        paid_amount: allocation.paidAmount,
        status,
      };

      if (allocation.paidAmount > 0) {
        planUpdate.last_payment_date = allocation.dueDate;
      } else {
        planUpdate.last_payment_date = "";
      }

      const planResult = await target.collection("payment_plan").updateOne(
        {
          legacySaleId: legacyId,
          legacyPaymentIndex: allocation.paymentIndex,
        },
        {
          $set: {
            ...planUpdate,
            legacyPaymentIndex: allocation.paymentIndex,
          },
        }
      );
      plansUpdated += planResult.matchedCount;

      const plan = await target.collection("payment_plan").findOne({
        legacySaleId: legacyId,
        legacyPaymentIndex: allocation.paymentIndex,
      });

      if (allocation.paidAmount > 0 && plan) {
        await target.collection("payment").updateOne(
          {
            legacySaleId: legacyId,
            legacyPaymentIndex: allocation.paymentIndex,
          },
          {
            $set: {
              sale_id: String(targetSale._id),
              payment_plan_id: String(plan._id),
              amount: allocation.paidAmount,
              date: allocation.dueDate,
              legacyPaymentIndex: allocation.paymentIndex,
            },
          },
          { upsert: true }
        );
        paymentsUpserted += 1;
      } else {
        const deleteResult = await target.collection("payment").deleteMany({
          legacySaleId: legacyId,
          legacyPaymentIndex: allocation.paymentIndex,
        });
        paymentsDeleted += deleteResult.deletedCount;
      }
    }

    const currentPayments = await target.collection("payment").find({
      legacySaleId: legacyId,
      legacyPaymentIndex: { $ne: "extra" },
    }).toArray();
    const allocatedPaid = currentPayments.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    const extraPaidAmount = Math.max((Number(legacySale.totalPaid) || 0) - allocatedPaid, 0);

    if (extraPaidAmount > 0) {
      await target.collection("payment").updateOne(
        {
          legacySaleId: legacyId,
          legacyPaymentIndex: "extra",
        },
        {
          $set: {
            sale_id: String(targetSale._id),
            amount: extraPaidAmount,
            date: normalizeString(legacySale.salesDate) || "",
            legacyPaymentIndex: "extra",
            legacySyntheticType: "carryover",
          },
        },
        { upsert: true }
      );
      paymentsUpserted += 1;
    } else {
      const deleteExtra = await target.collection("payment").deleteMany({
        legacySaleId: legacyId,
        legacyPaymentIndex: "extra",
      });
      paymentsDeleted += deleteExtra.deletedCount;
    }

    const totalPaid = Number(legacySale.totalPaid) || 0;
    const total = Number(targetSale.total) || Number(legacySale.totalSales) || 0;
    const balanceDue = Math.max(Number(legacySale.owes) || 0, 0);

    await target.collection("sales").updateOne(
      { _id: targetSale._id },
      {
        $set: {
          total_paid: totalPaid,
          balance_due: balanceDue,
          payment_status: inferSalePaymentStatus({
            saleStatus: targetSale.status,
            total,
            totalPaid,
          }),
        },
      }
    );
    salesUpdated += 1;
  }

  const paymentSum = (
    await target.collection("payment").aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]).toArray()
  )[0]?.total || 0;

  const salesPaidSum = (
    await target.collection("sales").aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$total_paid", 0] } } } },
    ]).toArray()
  )[0]?.total || 0;

  const balanceDueSum = (
    await target.collection("sales").aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$balance_due", 0] } } } },
    ]).toArray()
  )[0]?.total || 0;

  console.log(
    JSON.stringify(
      {
        sourceDb: SOURCE_DB_NAME,
        targetDb: TARGET_DB_NAME,
        salesUpdated,
        plansUpdated,
        paymentsUpserted,
        paymentsDeleted,
        paymentSum,
        salesPaidSum,
        balanceDueSum,
      },
      null,
      2
    )
  );

  await source.close();
  await target.close();
}

main().catch(async (error) => {
  console.error("reconcileLegacyPayments error:", error);
  for (const connection of mongoose.connections) {
    try {
      if (connection.readyState !== 0) {
        await connection.close();
      }
    } catch {}
  }
  process.exit(1);
});

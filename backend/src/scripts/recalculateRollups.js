const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return Boolean(value);
}

function inferSalePaymentStatus({ saleStatus, total, totalPaid }) {
  if (saleStatus === "Cancelada") return "Cancelada";
  if (saleStatus === "Borrador") return "Borrador";

  const safeTotal = toNumber(total);
  const safePaid = toNumber(totalPaid);

  if (safeTotal > 0 && safePaid >= safeTotal) return "Pagada";
  if (safePaid > 0) return "Parcial";
  return "Pendiente";
}

async function aggregateMap(collection, matchField, valueField, extraMatch = {}) {
  const rows = await collection
    .aggregate([
      { $match: extraMatch },
      {
        $group: {
          _id: `$${matchField}`,
          total: { $sum: { $ifNull: [`$${valueField}`, 0] } },
        },
      },
    ])
    .toArray();

  return new Map(
    rows
      .filter((row) => row?._id !== undefined && row?._id !== null && row._id !== "")
      .map((row) => [String(row._id), toNumber(row.total)])
  );
}

async function recalculateSales(db) {
  const salesCollection = db.collection("sales");
  const saleItemsCollection = db.collection("sale_item");
  const paymentsCollection = db.collection("payment");

  const subtotalBySale = await aggregateMap(saleItemsCollection, "sale", "subtotal");
  const totalBySale = await aggregateMap(saleItemsCollection, "sale", "total");
  const paidBySale = await aggregateMap(paymentsCollection, "sale_id", "amount");

  const sales = await salesCollection.find({}).toArray();
  let updated = 0;

  for (const sale of sales) {
    const saleId = String(sale._id);
    const subtotal = subtotalBySale.get(saleId) || 0;
    const total = totalBySale.get(saleId) || 0;
    const totalPaid = paidBySale.get(saleId) || 0;
    const balanceDue =
      sale.legacyOwes !== undefined && sale.legacyOwes !== null && sale.legacyOwes !== ""
        ? Math.max(toNumber(sale.legacyOwes), 0)
        : Math.max(total - totalPaid, 0);
    const paymentStatus = inferSalePaymentStatus({
      saleStatus: sale.status,
      total,
      totalPaid,
    });

    const nextValues = {
      subtotal,
      total,
      total_paid: totalPaid,
      balance_due: balanceDue,
      payment_status: paymentStatus,
    };

    const hasChanges =
      toNumber(sale.subtotal) !== subtotal ||
      toNumber(sale.total) !== total ||
      toNumber(sale.total_paid) !== totalPaid ||
      toNumber(sale.balance_due) !== balanceDue ||
      String(sale.payment_status || "") !== paymentStatus;

    if (!hasChanges) continue;

    await salesCollection.updateOne({ _id: sale._id }, { $set: nextValues });
    updated += 1;
  }

  return {
    totalSales: sales.length,
    updated,
  };
}

async function recalculateProducts(db) {
  const productsCollection = db.collection("product");
  const saleItemsCollection = db.collection("sale_item");
  const stockCollection = db.collection("stock");

  const soldByProduct = await aggregateMap(saleItemsCollection, "product", "quantity", {
    sale_status: "Completada",
  });
  const purchasedByProduct = await aggregateMap(stockCollection, "product", "purchased");

  const products = await productsCollection.find({}).toArray();
  let updated = 0;

  for (const product of products) {
    const productId = String(product._id);
    const sold = soldByProduct.get(productId) || 0;
    const purchaseditems = purchasedByProduct.get(productId) || 0;
    const trackInventory = toBoolean(product.track_inventory, false);
    const available = trackInventory ? purchaseditems - sold : 0;

    const nextValues = {
      track_inventory: trackInventory,
      sold,
      purchaseditems,
      available,
    };

    const hasChanges =
      toBoolean(product.track_inventory, false) !== trackInventory ||
      toNumber(product.sold) !== sold ||
      toNumber(product.purchaseditems) !== purchaseditems ||
      toNumber(product.available) !== available ||
      product.track_inventory === undefined ||
      product.track_inventory === null ||
      product.available === undefined ||
      product.available === null;

    if (!hasChanges) continue;

    await productsCollection.updateOne({ _id: product._id }, { $set: nextValues });
    updated += 1;
  }

  return {
    totalProducts: products.length,
    updated,
  };
}

async function verifyState(db) {
  const salesCollection = db.collection("sales");
  const productsCollection = db.collection("product");

  const negativeBalances = await salesCollection.countDocuments({ balance_due: { $lt: 0 } });
  const nonTrackedAvailable = await productsCollection.countDocuments({
    $or: [{ track_inventory: false }, { track_inventory: { $exists: false } }],
    available: { $ne: 0 },
  });

  return {
    negativeBalances,
    nonTrackedAvailable,
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no esta configurado.");
  }

  const connection = await mongoose.createConnection(process.env.MONGO_URI, {
    dbName: TARGET_DB_NAME,
  }).asPromise();

  const salesResult = await recalculateSales(connection);
  const productResult = await recalculateProducts(connection);
  const verification = await verifyState(connection);

  console.log(
    JSON.stringify(
      {
        targetDb: TARGET_DB_NAME,
        salesResult,
        productResult,
        verification,
      },
      null,
      2
    )
  );

  await connection.close();
}

main().catch(async (error) => {
  console.error("recalculateRollups error:", error);
  for (const connection of mongoose.connections) {
    try {
      if (connection.readyState !== 0) {
        await connection.close();
      }
    } catch {}
  }
  process.exit(1);
});

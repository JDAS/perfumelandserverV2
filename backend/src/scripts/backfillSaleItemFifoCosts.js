const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";
const customRecordSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

function getCustomRecordModelForConnection(connection, objectName) {
  const modelName = `fifo_backfill_${connection.name}_${objectName}`;
  return connection.models[modelName] || connection.model(modelName, customRecordSchema, objectName);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDate(value) {
  if (!value) return new Date(0);
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function roundCurrency(value) {
  return Math.round(toNumber(value));
}

function normalizeId(value) {
  return value ? String(value) : "";
}

function hasLegacyMarker(item = {}) {
  return Boolean(
    item.legacySaleId ||
      item.legacyLineIndex !== undefined ||
      item.legacyProductName ||
      item.legacyProductId
  );
}

function consumeFifo(layers, quantity) {
  let remaining = toNumber(quantity);
  const consumed = [];
  let totalCost = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const available = toNumber(layer.remaining);
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    layer.remaining -= take;
    remaining -= take;
    const unitCost = toNumber(layer.unitCost);
    const cost = take * unitCost;
    totalCost += cost;
    consumed.push({
      stockId: layer.stockId,
      quantity: take,
      unitCost,
      totalCost: roundCurrency(cost),
    });
  }

  return {
    consumed,
    missingQuantity: remaining,
    totalCost: roundCurrency(totalCost),
    unitCost: quantity > 0 ? roundCurrency(totalCost / quantity) : 0,
  };
}

function isReliableStockLayer(stock = {}) {
  const unitCost = toNumber(stock.wholesaleprice);
  const purchased = toNumber(stock.purchased);
  if (stock.legacy_inventory_seed === true) return false;
  if (unitCost <= 0 || purchased <= 0) return false;
  if (!Number.isInteger(unitCost)) return false;
  return true;
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no esta configurado.");
  }

  const dryRun = !process.argv.includes("--write");
  const productArg = process.argv.find((arg) => arg.startsWith("--product="));
  const onlyProductId = productArg ? productArg.split("=")[1] : "";

  const connection = await mongoose
    .createConnection(process.env.MONGO_URI, { dbName: TARGET_DB_NAME })
    .asPromise();

  try {
    const StockModel = getCustomRecordModelForConnection(connection, "stock");
    const SaleItemModel = getCustomRecordModelForConnection(connection, "sale_item");
    const SaleModel = getCustomRecordModelForConnection(connection, "sales");
    const ProductModel = getCustomRecordModelForConnection(connection, "product");

    const stockQuery = onlyProductId ? { product: onlyProductId } : {};
    const stockRows = await StockModel.find(stockQuery)
      .select("product wholesaleprice purchased createdAt legacy_inventory_seed name")
      .sort({ product: 1, createdAt: 1, _id: 1 })
      .lean();
    const realStockRows = stockRows.filter(isReliableStockLayer);
    const ignoredStockRows = stockRows.filter((row) => !isReliableStockLayer(row));

    const productIds = [
      ...new Set(
        [
          ...stockRows.map((row) => normalizeId(row.product)),
          ...realStockRows.map((row) => normalizeId(row.product)),
        ].filter(Boolean)
      ),
    ];
    const saleItemQuery = {
      product: { $in: productIds },
      sale_status: "Completada",
      legacySaleId: { $exists: false },
    };
    if (onlyProductId) saleItemQuery.product = onlyProductId;

    const saleItems = await SaleItemModel.find(saleItemQuery)
      .sort({ product: 1, createdAt: 1, _id: 1 })
      .lean();

    const saleIds = [...new Set(saleItems.map((item) => normalizeId(item.sale)).filter(Boolean))];
    const [sales, products] = await Promise.all([
      saleIds.length
        ? SaleModel.find({ _id: { $in: saleIds } }).select("saledate createdAt status legacyId").lean()
        : [],
      productIds.length ? ProductModel.find({ _id: { $in: productIds } }).select("name").lean() : [],
    ]);

    const saleMap = new Map(sales.map((sale) => [String(sale._id), sale]));
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const stockByProduct = new Map();

    for (const stock of realStockRows) {
      const productId = normalizeId(stock.product);
      if (!productId) continue;
      if (!stockByProduct.has(productId)) stockByProduct.set(productId, []);
      stockByProduct.get(productId).push({
        stockId: String(stock._id),
        remaining: toNumber(stock.purchased),
        unitCost: toNumber(stock.wholesaleprice),
        createdAt: stock.createdAt,
      });
    }

    const itemsByProduct = new Map();
    const orphanSaleItems = [];

    for (const item of saleItems) {
      if (hasLegacyMarker(item)) continue;
      const sale = saleMap.get(normalizeId(item.sale));
      if (!sale) {
        orphanSaleItems.push({
          saleItemId: String(item._id),
          saleId: normalizeId(item.sale),
          productId: normalizeId(item.product),
          quantity: toNumber(item.quantity) || 1,
        });
        continue;
      }
      const productId = normalizeId(item.product);
      if (!productId) continue;
      if (!itemsByProduct.has(productId)) itemsByProduct.set(productId, []);
      itemsByProduct.get(productId).push(item);
    }

    const changes = [];
    const warnings = [];
    const skippedInsufficientStock = [];
    const productSummaries = [];
    let reviewed = 0;

    for (const [productId, items] of itemsByProduct.entries()) {
      const layers = (stockByProduct.get(productId) || []).map((layer) => ({ ...layer }));
      const realStockUnits = layers.reduce((sum, layer) => sum + toNumber(layer.remaining), 0);
      const orderedItems = [...items].sort((left, right) => {
        const leftSale = saleMap.get(normalizeId(left.sale));
        const rightSale = saleMap.get(normalizeId(right.sale));
        const leftDate = toDate(leftSale?.saledate || leftSale?.createdAt || left.createdAt).getTime();
        const rightDate = toDate(rightSale?.saledate || rightSale?.createdAt || right.createdAt).getTime();
        if (leftDate !== rightDate) return leftDate - rightDate;
        return String(left._id).localeCompare(String(right._id));
      });
      const requestedUnits = orderedItems.reduce((sum, item) => sum + (toNumber(item.quantity) || 1), 0);
      const productName = productMap.get(productId)?.name || productId;

      for (const item of orderedItems) {
        reviewed += 1;
        const quantity = toNumber(item.quantity) || 1;
        const fifo = consumeFifo(layers, quantity);
        const currentUnitCost = toNumber(item.cost_snapshot);
        const currentTotalCost = roundCurrency(currentUnitCost * quantity);
        const hasDifference =
          currentUnitCost !== fifo.unitCost ||
          toNumber(item.cost_snapshot_total) !== fifo.totalCost;

        if (fifo.missingQuantity > 0) {
          const warning = {
            saleItemId: String(item._id),
            productId,
            productName,
            quantity,
            missingQuantity: fifo.missingQuantity,
          };
          warnings.push(warning);
          skippedInsufficientStock.push(warning);
          continue;
        }

        if (!hasDifference) continue;

        const change = {
          saleItemId: String(item._id),
          saleId: normalizeId(item.sale),
          productId,
          productName,
          quantity,
          currentUnitCost,
          currentTotalCost,
          fifoUnitCost: fifo.unitCost,
          fifoTotalCost: fifo.totalCost,
          deltaTotal: fifo.totalCost - currentTotalCost,
          costLayers: fifo.consumed,
          missingQuantity: fifo.missingQuantity,
        };
        changes.push(change);

        if (!dryRun) {
          await SaleItemModel.updateOne(
            { _id: item._id },
            {
              $set: {
                cost_snapshot: fifo.unitCost,
                cost_snapshot_total: fifo.totalCost,
                cost_layers: fifo.consumed,
                cost_method: "fifo",
              },
            }
          );
        }
      }

      productSummaries.push({
        productId,
        productName,
        realStockUnits,
        requestedUnits,
        remainingRealStockUnits: layers.reduce((sum, layer) => sum + toNumber(layer.remaining), 0),
        ignoredStockRows: ignoredStockRows.filter((row) => normalizeId(row.product) === productId).length,
      });
    }

    const totalDelta = changes.reduce((sum, change) => sum + change.deltaTotal, 0);

    console.log(
      JSON.stringify(
        {
          dryRun,
          targetDb: TARGET_DB_NAME,
          productFilter: onlyProductId || "",
          reviewed,
          changed: changes.length,
          warnings: warnings.length,
          skippedInsufficientStock: skippedInsufficientStock.length,
          orphanSaleItems: orphanSaleItems.length,
          ignoredStockRows: ignoredStockRows.length,
          totalDelta,
          productSummaries: productSummaries
            .filter(
              (summary) =>
                summary.ignoredStockRows > 0 ||
                summary.realStockUnits < summary.requestedUnits ||
                summary.remainingRealStockUnits !== summary.realStockUnits
            )
            .slice(0, 50),
          sampleChanges: changes.slice(0, 30),
          sampleWarnings: warnings.slice(0, 30),
          sampleOrphanSaleItems: orphanSaleItems.slice(0, 30),
        },
        null,
        2
      )
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error("backfillSaleItemFifoCosts error:", error);
  process.exitCode = 1;
});

const mongoose = require("mongoose");

function getCustomRecordModelForConnection(connection, objectName) {
  const modelName = `legacy_inventory_${connection.name}_${objectName}`;

  if (connection.models[modelName]) {
    return connection.models[modelName];
  }

  const schema = new mongoose.Schema({}, { strict: false, timestamps: true });
  return connection.model(modelName, schema, objectName);
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundCurrency(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function getCalendarDate(value) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate()
  );
}

function shiftDays(value, days) {
  if (!value) return null;
  const shifted = new Date(value);
  shifted.setDate(shifted.getDate() + Number(days || 0));
  return shifted;
}

async function seedLegacyInventoryFromSales({
  connection,
  dryRun = false,
}) {
  const stockObject = await connection
    .collection("customobjects")
    .findOne({ apiName: "stock" });

  if (!stockObject) {
    throw new Error(`No existe el CustomObject destino "stock" en ${connection.name}.`);
  }

  const ProductModel = getCustomRecordModelForConnection(connection, "product");
  const SaleItemModel = getCustomRecordModelForConnection(connection, "sale_item");
  const SaleModel = getCustomRecordModelForConnection(connection, "sales");
  const stockCollection = connection.collection("stock");

  const saleItems = await SaleItemModel.find({
    product: { $exists: true, $ne: "" },
    sale_status: "Completada",
    legacySaleId: { $exists: true, $ne: "" },
  })
    .select(
      "product quantity cost_snapshot sale legacySaleId legacyProductName createdAt"
    )
    .lean();

  const summary = {
    dryRun,
    sourceSaleItems: saleItems.length,
    productsDetected: 0,
    inserted: 0,
    updated: 0,
    touchedProductIds: [],
  };

  if (!saleItems.length) {
    return summary;
  }

  const products = await ProductModel.find({}, { _id: 1, name: 1 }).lean();
  const productsById = new Map(
    products.map((product) => [String(product._id), product])
  );

  const saleIds = [
    ...new Set(saleItems.map((item) => String(item?.sale || "")).filter(Boolean)),
  ];

  const sales = saleIds.length
    ? await SaleModel.find({ _id: { $in: saleIds } })
        .select("saledate createdAt")
        .lean()
    : [];

  const salesById = new Map(sales.map((sale) => [String(sale._id), sale]));
  const groupedByProduct = new Map();

  for (const item of saleItems) {
    const productId = String(item?.product || "");
    const quantity = Math.max(toNumber(item?.quantity), 0);
    if (!productId || quantity <= 0) continue;

    const sale = salesById.get(String(item?.sale || ""));
    const saleDate =
      getCalendarDate(sale?.saledate) ||
      getCalendarDate(sale?.createdAt) ||
      getCalendarDate(item?.createdAt);

    if (!groupedByProduct.has(productId)) {
      groupedByProduct.set(productId, {
        productId,
        quantity: 0,
        totalCost: 0,
        latestCost: 0,
        earliestDate: saleDate,
        legacyProductName: String(item?.legacyProductName || "").trim(),
      });
    }

    const current = groupedByProduct.get(productId);
    const costSnapshot = Math.max(toNumber(item?.cost_snapshot), 0);

    current.quantity += quantity;
    current.totalCost += costSnapshot * quantity;

    if (costSnapshot > 0) {
      current.latestCost = costSnapshot;
    }

    if (saleDate && (!current.earliestDate || saleDate < current.earliestDate)) {
      current.earliestDate = saleDate;
    }
  }

  summary.productsDetected = groupedByProduct.size;

  const existingSeeds = await stockCollection
    .find({
      legacy_inventory_seed: true,
      product: { $in: [...groupedByProduct.keys()] },
    })
    .project({ _id: 1, product: 1, createdAt: 1 })
    .toArray();

  const existingSeedsByProduct = new Map(
    existingSeeds.map((row) => [String(row.product), row])
  );

  for (const group of groupedByProduct.values()) {
    const product = productsById.get(group.productId);
    const wholesaleprice =
      group.totalCost > 0
        ? roundCurrency(group.totalCost / group.quantity)
        : roundCurrency(group.latestCost);
    const seedDate = shiftDays(group.earliestDate || new Date(), -1) || new Date();
    const payload = {
      product: group.productId,
      purchased: group.quantity,
      wholesaleprice,
      name:
        (product?.name || group.legacyProductName || "Producto") +
        " inventario legacy",
      legacy_inventory_seed: true,
      legacy_inventory_source: "sales",
      legacy_inventory_quantity: group.quantity,
      updatedAt: new Date(),
    };

    const existingSeed = existingSeedsByProduct.get(group.productId);
    summary.touchedProductIds.push(group.productId);

    if (existingSeed) {
      if (!dryRun) {
        await stockCollection.updateOne(
          { _id: existingSeed._id },
          {
            $set: payload,
            $min: { createdAt: seedDate },
          }
        );
      }
      summary.updated += 1;
      continue;
    }

    if (!dryRun) {
      await stockCollection.insertOne({
        ...payload,
        createdAt: seedDate,
      });
    }
    summary.inserted += 1;
  }

  summary.touchedProductIds = [...new Set(summary.touchedProductIds)];
  return summary;
}

async function syncInventoryForProductsOnConnection({
  connection,
  productIds = [],
  dryRun = false,
}) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean).map(String))];
  const ProductModel = getCustomRecordModelForConnection(connection, "product");
  const StockModel = getCustomRecordModelForConnection(connection, "stock");
  const SaleItemModel = getCustomRecordModelForConnection(connection, "sale_item");
  const SaleModel = getCustomRecordModelForConnection(connection, "sales");

  const summary = {
    dryRun,
    reviewed: uniqueProductIds.length,
    updated: 0,
  };

  for (const productId of uniqueProductIds) {
    const [product, stockRows, saleItems] = await Promise.all([
      ProductModel.findById(productId),
      StockModel.find({ product: productId }).sort({ createdAt: 1, _id: 1 }).lean(),
      SaleItemModel.find({
        product: productId,
        sale_status: "Completada",
      }).lean(),
    ]);

    if (!product) continue;

    const purchaseditems = stockRows.reduce(
      (sum, row) => sum + toNumber(row?.purchased),
      0
    );
    const hasRealStock = purchaseditems > 0;
    const firstStockAt = stockRows.length
      ? getCalendarDate(stockRows[0]?.createdAt)
      : null;
    const trackingStart =
      getCalendarDate(product.inventory_tracking_started_at) || firstStockAt;

    let sold = 0;

    if (saleItems.length > 0) {
      const saleIds = [
        ...new Set(saleItems.map((item) => String(item?.sale || "")).filter(Boolean)),
      ];

      const sales = await SaleModel.find({ _id: { $in: saleIds } })
        .select("saledate createdAt")
        .lean();

      const salesMap = new Map(sales.map((sale) => [String(sale._id), sale]));

      sold = saleItems.reduce((sum, item) => {
        const relatedSale = salesMap.get(String(item?.sale || ""));
        const saleDate =
          getCalendarDate(relatedSale?.saledate) ||
          getCalendarDate(relatedSale?.createdAt);

        if (trackingStart && saleDate && saleDate < trackingStart) {
          return sum;
        }

        return sum + toNumber(item?.quantity);
      }, 0);
    }

    const trackInventory = hasRealStock || Boolean(product.track_inventory);
    const available = trackInventory ? purchaseditems - sold : 0;

    const nextValues = {
      purchaseditems,
      sold,
      available,
      track_inventory: trackInventory,
    };

    if (firstStockAt) {
      nextValues.inventory_tracking_started_at = firstStockAt;
    }

    const hasChanges =
      toNumber(product.purchaseditems) !== purchaseditems ||
      toNumber(product.sold) !== sold ||
      toNumber(product.available) !== available ||
      Boolean(product.track_inventory) !== trackInventory ||
      String(product.inventory_tracking_started_at || "") !==
        String(firstStockAt || product.inventory_tracking_started_at || "");

    if (!hasChanges) continue;

    if (!dryRun) {
      product.set(nextValues);
      Object.keys(nextValues).forEach((key) => product.markModified(key));
      await product.save();
    }

    summary.updated += 1;
  }

  return summary;
}

module.exports = {
  seedLegacyInventoryFromSales,
  syncInventoryForProductsOnConnection,
};

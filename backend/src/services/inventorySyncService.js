const { getCustomRecordModel } = require("../models/CustomRecord");

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
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

async function syncInventoryForProducts(productIds = []) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean).map(String))];
  if (!uniqueProductIds.length) return;

  const ProductModel = getCustomRecordModel("product");
  const StockModel = getCustomRecordModel("stock");
  const SaleItemModel = getCustomRecordModel("sale_item");
  const SaleModel = getCustomRecordModel("sales");

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

    product.set(nextValues);
    Object.keys(nextValues).forEach((key) => product.markModified(key));
    await product.save();
  }
}

module.exports = {
  syncInventoryForProducts,
};

const { getCustomRecordModel } = require("../models/CustomRecord");
const {
  resolveSupplierCatalogCsvPath,
  loadSupplierCatalog,
  buildSupplierCatalogIndex,
  matchSupplierEntryToProduct,
} = require("./supplierCatalogService");
const { createHttpError } = require("../utils/httpError");

function formatSyncDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function roundToTwo(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildPricingSignals(product, nextWholesalePrice) {
  const currentProductPrice = Number(product?.price) || 0;
  const previousWholesalePrice = Number(product?.supplier_last_wholesale_price) || 0;
  const currentWholesalePrice = Number(nextWholesalePrice) || 0;
  const delta = currentWholesalePrice - previousWholesalePrice;
  const deltaPct =
    previousWholesalePrice > 0
      ? roundToTwo((delta / previousWholesalePrice) * 100)
      : 0;

  const suggestedMinCashPrice =
    currentWholesalePrice > 0 ? currentWholesalePrice + 5000 : null;

  return {
    supplier_previous_wholesale_price: previousWholesalePrice || null,
    supplier_wholesale_delta: previousWholesalePrice > 0 ? delta : 0,
    supplier_wholesale_delta_pct: previousWholesalePrice > 0 ? deltaPct : 0,
    supplier_change_alert: previousWholesalePrice > 0 ? Math.abs(deltaPct) >= 15 : false,
    suggested_min_cash_price: suggestedMinCashPrice,
    cash_price_risk_alert:
      currentWholesalePrice > 0 ? currentProductPrice - currentWholesalePrice < 5000 : false,
  };
}

function buildSupplierReferencePayload(product, matchResult) {
  const payload = {
    supplier_match_name: "",
    supplier_match_type: "Sin match",
    supplier_last_wholesale_price: null,
    supplier_price_raw: "",
    supplier_is_offer: false,
    supplier_last_sync_at: formatSyncDate(),
    supplier_previous_wholesale_price: Number(product?.supplier_last_wholesale_price) || null,
    supplier_wholesale_delta: 0,
    supplier_wholesale_delta_pct: 0,
    supplier_change_alert: false,
    suggested_min_cash_price: null,
    cash_price_risk_alert: false,
  };

  if (!matchResult?.entry) {
    return payload;
  }

  const pricingSignals = buildPricingSignals(
    product,
    matchResult.entry.supplier_price_value
  );

  return {
    supplier_match_name: matchResult.entry.supplier_name,
    supplier_match_type: matchResult.matchType,
    supplier_last_wholesale_price: matchResult.entry.supplier_price_value,
    supplier_price_raw: matchResult.entry.supplier_price_raw,
    supplier_is_offer: Boolean(matchResult.entry.supplier_is_offer),
    supplier_last_sync_at: formatSyncDate(),
    ...pricingSignals,
  };
}

async function loadSupplierIndex() {
  const csvPath = resolveSupplierCatalogCsvPath();
  const entries = await loadSupplierCatalog(csvPath);
  return {
    csvPath,
    entries,
    index: buildSupplierCatalogIndex(entries),
  };
}

async function refreshProductSupplierReference({ productId }) {
  const ProductRecord = getCustomRecordModel("product");
  const product = await ProductRecord.findById(productId).lean();

  if (!product) {
    throw createHttpError(404, "Producto no encontrado");
  }

  const supplierCatalog = await loadSupplierIndex();
  const matchResult = matchSupplierEntryToProduct(product, supplierCatalog.index);
  const payload = buildSupplierReferencePayload(product, matchResult);

  await ProductRecord.updateOne(
    { _id: productId },
    {
      $set: payload,
    }
  );

  const updatedRecord = await ProductRecord.findById(productId).lean();

  return {
    record: updatedRecord,
    supplierReference: {
      csvPath: supplierCatalog.csvPath,
      matchType: matchResult.matchType,
      matchedBy: matchResult.matchedBy,
      entry: matchResult.entry,
      payload,
    },
  };
}

module.exports = {
  buildPricingSignals,
  buildSupplierReferencePayload,
  refreshProductSupplierReference,
};

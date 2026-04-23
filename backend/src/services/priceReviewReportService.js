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

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getReviewReason(product) {
  const reasons = [];
  if (product.cash_price_risk_alert) {
    reasons.push("Riesgo contado");
  }
  if (product.supplier_change_alert) {
    reasons.push("Cambio proveedor");
  }
  if (product.supplier_is_offer) {
    reasons.push("Oferta proveedor");
  }
  return reasons.length ? reasons.join(", ") : "Sin alerta";
}

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (["all", "risk", "change", "offer"].includes(mode)) return mode;
  return "alerts";
}

async function executePriceReviewReport(reportDefinition, options = {}) {
  const ProductModel = getCustomRecordModel("product");
  const objectDefinition = await CustomObject.findOne({ apiName: "product" }).lean();
  if (!objectDefinition) {
    const error = new Error("Objeto fuente no encontrado: product");
    error.statusCode = 404;
    throw error;
  }

  const mode = normalizeMode(options.mode);
  const products = await ProductModel.find({ isactive: { $ne: false } })
    .sort({
      cash_price_risk_alert: -1,
      supplier_change_alert: -1,
      supplier_is_offer: -1,
      name: 1,
      _id: 1,
    })
    .lean();

  const rows = products
    .map((product) => {
      const price = toNumber(product.price);
      const supplierWholesale = toNumber(product.supplier_last_wholesale_price);
      const suggestedMinCashPrice = toNumber(product.suggested_min_cash_price);
      const cashGap = supplierWholesale > 0 ? price - supplierWholesale : 0;
      const suggestedDelta =
        suggestedMinCashPrice > 0 ? Math.max(suggestedMinCashPrice - price, 0) : 0;

      return {
        product_id: String(product._id),
        product_id__label: product.name || "Sin nombre",
        name: product.name || "Sin nombre",
        brand: product.brand || "",
        price,
        price_formatted: formatCurrency(price),
        supplier_last_wholesale_price: supplierWholesale,
        supplier_last_wholesale_price_formatted: supplierWholesale
          ? formatCurrency(supplierWholesale)
          : "-",
        suggested_min_cash_price: suggestedMinCashPrice,
        suggested_min_cash_price_formatted: suggestedMinCashPrice
          ? formatCurrency(suggestedMinCashPrice)
          : "-",
        cash_gap: cashGap,
        cash_gap_formatted: supplierWholesale ? formatCurrency(cashGap) : "-",
        suggested_delta: suggestedDelta,
        suggested_delta_formatted: suggestedDelta ? formatCurrency(suggestedDelta) : "-",
        supplier_wholesale_delta_pct: toNumber(product.supplier_wholesale_delta_pct),
        supplier_wholesale_delta_pct_formatted:
          product.supplier_previous_wholesale_price != null
            ? `${toNumber(product.supplier_wholesale_delta_pct).toFixed(2)}%`
            : "-",
        supplier_change_alert: Boolean(product.supplier_change_alert),
        cash_price_risk_alert: Boolean(product.cash_price_risk_alert),
        supplier_is_offer: Boolean(product.supplier_is_offer),
        supplier_match_name: product.supplier_match_name || "",
        supplier_match_type: product.supplier_match_type || "",
        supplier_last_sync_at: formatDateOnly(product.supplier_last_sync_at),
        review_reason: getReviewReason(product),
      };
    })
    .filter((row) => {
      if (mode === "all") return true;
      if (mode === "risk") return row.cash_price_risk_alert;
      if (mode === "change") return row.supplier_change_alert;
      if (mode === "offer") return row.supplier_is_offer;
      return row.cash_price_risk_alert || row.supplier_change_alert;
    });

  const summary = {
    products_count: products.length,
    rows_count: rows.length,
    cash_risk_count: products.filter((product) => product.cash_price_risk_alert).length,
    supplier_change_count: products.filter((product) => product.supplier_change_alert).length,
    supplier_offer_count: products.filter((product) => product.supplier_is_offer).length,
  };

  return {
    viewType: "price_review",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: objectDefinition.name,
    totalSourceRecords: products.length,
    filterMode: mode,
    columns: [
      { id: "name", label: "Producto", type: "text" },
      { id: "price_formatted", label: "Precio detalle", type: "text" },
      { id: "supplier_last_wholesale_price_formatted", label: "Mayorista", type: "text" },
      { id: "cash_gap_formatted", label: "Diferencia contado", type: "text" },
      { id: "suggested_min_cash_price_formatted", label: "Minimo sugerido", type: "text" },
      { id: "supplier_wholesale_delta_pct_formatted", label: "Cambio mayorista", type: "text" },
      { id: "review_reason", label: "Revision", type: "text" },
      { id: "supplier_last_sync_at", label: "Ultima sync", type: "date" },
    ],
    rows,
    summary,
  };
}

module.exports = {
  executePriceReviewReport,
};

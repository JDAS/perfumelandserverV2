const { getCustomRecordModel } = require("../models/CustomRecord");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");
const { saveRecord } = require("./customRecordService");
const { syncSaleCampaigns } = require("./campaignSyncService");

function normalizeDiscountScope(value = "", discount = 0) {
  if (
    value === "Sin descuento" ||
    value === "Solo contado" ||
    value === "Solo credito" ||
    value === "Ambos"
  ) {
    return value;
  }

  return Number(discount) > 0 ? "Ambos" : "Sin descuento";
}

function resolveScopedDiscount(scope, discount, paymentType) {
  const normalizedDiscount = Math.max(Number(discount) || 0, 0);
  const normalizedType = paymentType === "Credito" ? "Credito" : "Contado";
  const normalizedScope = normalizeDiscountScope(scope, normalizedDiscount);

  if (normalizedScope === "Sin descuento" || normalizedDiscount <= 0) return 0;
  if (normalizedScope === "Ambos") return normalizedDiscount;
  if (normalizedScope === "Solo contado") {
    return normalizedType === "Contado" ? normalizedDiscount : 0;
  }
  if (normalizedScope === "Solo credito") {
    return normalizedType === "Credito" ? normalizedDiscount : 0;
  }

  return 0;
}

async function resolveLatestStockCost(productId) {
  if (!productId) return undefined;

  const StockModel = getCustomRecordModel("stock");
  const latestStock = await StockModel.findOne({ product: String(productId) })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const cost = Number(latestStock?.wholesaleprice);
  return Number.isFinite(cost) ? cost : undefined;
}

async function convertQuoteToSale({ quoteId, user = null }) {
  const QuoteModel = getCustomRecordModel("quote");
  const QuoteItemModel = getCustomRecordModel("quote_item");
  const SaleItemModel = getCustomRecordModel("sale_item");
  const ProductModel = getCustomRecordModel("product");

  const quote = await QuoteModel.findById(quoteId).lean();

  if (!quote) {
    const error = new Error("Cotizacion no encontrada");
    error.statusCode = 404;
    throw error;
  }

  if (quote.status === "Convertida") {
    const error = new Error("Esta cotizacion ya fue convertida");
    error.statusCode = 409;
    throw error;
  }

  if (!quote.seller_id) {
    const error = new Error("La cotizacion necesita un vendedor antes de convertirse");
    error.statusCode = 400;
    throw error;
  }

  const quoteItems = await QuoteItemModel.find({ quote: String(quote._id) }).lean();

  if (!quoteItems.length) {
    const error = new Error("La cotizacion no tiene perfumes para convertir");
    error.statusCode = 400;
    throw error;
  }

  const unresolvedManualItems = quoteItems.filter(
    (item) =>
      item.pending_catalog_completion === true ||
      (!item.product && String(item.manual_product_name || "").trim())
  );

  if (unresolvedManualItems.length > 0) {
    const error = new Error(
      "Esta cotizacion tiene productos pendientes de catalogar. Debes vincularlos a productos activos antes de convertirla en venta"
    );
    error.statusCode = 400;
    throw error;
  }

  const productIds = [...new Set(quoteItems.map((item) => String(item.product || "")).filter(Boolean))];
  const productDocs = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }, { isactive: 1, name: 1, available: 1 }).lean()
    : [];
  const productMap = new Map(productDocs.map((product) => [String(product._id), product]));
  const inactiveProducts = quoteItems.filter((item) => {
    const product = productMap.get(String(item.product || ""));
    return !product || product.isactive === false;
  });

  if (inactiveProducts.length > 0) {
    const firstProduct = productMap.get(String(inactiveProducts[0].product || ""));
    const label =
      firstProduct?.name ||
      String(inactiveProducts[0].manual_product_name || "").trim() ||
      "producto";
    const error = new Error(
      `No se puede convertir la cotizacion porque ${label} no esta activo en catalogo`
    );
    error.statusCode = 400;
    throw error;
  }

  const requestedByProduct = quoteItems.reduce((map, item) => {
    const productId = String(item.product || "");
    map.set(productId, (map.get(productId) || 0) + (Number(item.quantity) || 0));
    return map;
  }, new Map());
  for (const [productId, requested] of requestedByProduct) {
    const product = productMap.get(productId);
    const available = Math.max(Number(product?.available) || 0, 0);
    if (requested > available) {
      const error = new Error(
        `No se puede convertir la cotizacion: stock insuficiente para ${product?.name || "el producto"}. Solicitado: ${requested}; disponible: ${available}`
      );
      error.statusCode = 400;
      error.code = "INSUFFICIENT_STOCK";
      throw error;
    }
  }

  const saleResult = await saveRecord({
    objectApiName: "sales",
    payload: {
      name: quote.name || "",
      saledate: quote.quote_date || "",
      status: "Borrador",
      type: quote.type || "Contado",
      credittype: quote.credittype || "Normal",
      seller_id: quote.seller_id,
      quotes: Number(quote.quotes) || 1,
      prize_credit: Math.max(Number(quote.prize_credit) || 0, 0),
      prize_reference: String(quote.prize_reference || "").trim(),
    },
    user,
  });

  const saleRecord =
    typeof saleResult.record?.toObject === "function"
      ? saleResult.record.toObject()
      : { ...saleResult.record };

  for (const quoteItem of quoteItems) {
    const quantity = Number(quoteItem.quantity) || 1;
    const price = Number(quoteItem.price) || 0;
    const listPrice = Number(quoteItem.list_price) || price;
    const discount = resolveScopedDiscount(
      quoteItem.discount_scope,
      quoteItem.discount,
      quote.type || "Contado"
    );
    const subtotal = quantity * price;
    const total = subtotal - discount;
    const costSnapshot = await resolveLatestStockCost(quoteItem.product);

    const createdSaleItem = await SaleItemModel.create({
      sale: String(saleRecord._id),
      product: quoteItem.product,
      quantity,
      price,
      list_price: listPrice,
      cost_snapshot: costSnapshot,
      discount,
      discount_scope: quoteItem.discount_scope || "Sin descuento",
      discount_reason: String(quoteItem.discount_reason || "").trim(),
      commission_applies: quoteItem.commission_applies !== false,
      subtotal,
      total,
      sale_status: saleRecord.status || "Borrador",
    });

    await recalculateParentRollupsFromChild({
      childObjectApiName: "sale_item",
      childRecord:
        typeof createdSaleItem.toObject === "function"
          ? createdSaleItem.toObject()
          : { ...createdSaleItem },
      previousChildRecord: null,
    });
  }

  await saveRecord({
    objectApiName: "quote",
    recordId: String(quote._id),
    payload: {
      status: "Convertida",
    },
    user,
  });

  await syncSaleCampaigns({
    saleId: String(saleRecord._id),
    user,
  });

  return {
    quoteId: String(quote._id),
    saleId: String(saleRecord._id),
    itemCount: quoteItems.length,
  };
}

module.exports = {
  convertQuoteToSale,
};

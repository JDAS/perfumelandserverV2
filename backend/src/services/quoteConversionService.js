const { getCustomRecordModel } = require("../models/CustomRecord");
const { recalculateParentRollupsFromChild } = require("../utils/rollupEngine");
const { saveRecord } = require("./customRecordService");

function normalizeDiscountScope(value = "") {
  if (value === "Solo contado" || value === "Solo credito" || value === "Ambos") {
    return value;
  }

  return "Ambos";
}

function resolveScopedDiscount(scope, discount, paymentType) {
  const normalizedDiscount = Math.max(Number(discount) || 0, 0);
  const normalizedType = paymentType === "Credito" ? "Credito" : "Contado";
  const normalizedScope = normalizeDiscountScope(scope);

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

  return {
    quoteId: String(quote._id),
    saleId: String(saleRecord._id),
    itemCount: quoteItems.length,
  };
}

module.exports = {
  convertQuoteToSale,
};

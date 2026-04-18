const { getCustomRecordModel } = require("../models/CustomRecord");
const { calculatePayments } = require("../utils/paymentEngine");

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCRC(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function normalizePaymentKeyword(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeDiscountScope(value = "") {
  if (value === "Solo contado" || value === "Solo credito" || value === "Ambos") {
    return value;
  }

  return "Ambos";
}

function getDiscountForScope(scope, discount, type) {
  const normalizedDiscount = Math.max(toNumber(discount), 0);
  const normalizedScope = normalizeDiscountScope(scope);
  const normalizedType = normalizePaymentKeyword(type) === "credito" ? "Credito" : "Contado";

  if (normalizedScope === "Ambos") return normalizedDiscount;
  if (normalizedScope === "Solo contado") {
    return normalizedType === "Contado" ? normalizedDiscount : 0;
  }
  if (normalizedScope === "Solo credito") {
    return normalizedType === "Credito" ? normalizedDiscount : 0;
  }

  return 0;
}

async function loadLookupNames(idsByObject = {}) {
  const result = {};

  for (const [objectApiName, ids] of Object.entries(idsByObject)) {
    const uniqueIds = [...new Set((ids || []).map((id) => String(id || "")).filter(Boolean))];
    if (!uniqueIds.length) continue;

    const Model = getCustomRecordModel(objectApiName);
    const docs = await Model.find({ _id: { $in: uniqueIds } }, { name: 1 }).lean();
    result[objectApiName] = new Map(docs.map((doc) => [String(doc._id), doc.name || "Sin nombre"]));
  }

  return result;
}

function buildSalesWhatsappText(summary) {
  return [
    "Resumen de Perfumes",
    "",
    ...summary.products.map((product) => {
      const discountText =
        product.discountAmount > 0
          ? ` (Descuento: ${formatCRC(product.discountAmount)})`
          : "";
      return `- ${product.name}: ${formatCRC(product.originalPrice)}${discountText}`;
    }),
    "",
    `Total: ${formatCRC(summary.totalOriginal)}`,
    `Total descuentos: ${formatCRC(summary.totalDiscounts)}`,
    `Total venta: ${formatCRC(summary.totalSale)}`,
    `Pagado: ${formatCRC(summary.totalPaid)}`,
    `Pendiente: ${formatCRC(summary.balanceDue)}`,
  ].join("\n");
}

function buildQuoteWhatsappText(summary, payments) {
  const products = Array.isArray(summary.products) ? summary.products : [];
  const totalUnits = products.reduce(
    (sum, product) => sum + (toNumber(product.quantity) || 1),
    0
  );
  const productCount = products.length;

  if (productCount === 0) {
    return `Hola, tu cotizacion sale para ${formatCRC(summary.cashTotal)} al contado.`;
  }

  const productLines = products.map((product) => {
    const quantity = toNumber(product.quantity) || 1;
    return quantity > 1
      ? `- ${product.name} x${quantity}`
      : `- ${product.name}`;
  });

  const lines = [];
  lines.push(
    productCount === 1 && totalUnits === 1
      ? "Hola, te comparto la cotizacion de este perfume:"
      : "Hola, te comparto la cotizacion de estos perfumes:"
  );
  lines.push("");
  lines.push(...productLines);
  lines.push("");
  lines.push(
    totalUnits > 1
      ? `Total al contado por ${totalUnits} unidades: ${formatCRC(summary.cashTotal)}`
      : `Total al contado: ${formatCRC(summary.cashTotal)}`
  );

  if (summary.cashDiscountTotal > 0 && summary.creditDiscountTotal > 0) {
    if (summary.cashDiscountTotal === summary.creditDiscountTotal) {
      lines.push(
        `Se aplica un descuento de ${formatCRC(summary.cashDiscountTotal)} tanto al contado como al credito.`
      );
    } else {
      lines.push(
        `Se aplica un descuento de ${formatCRC(summary.cashDiscountTotal)} al contado y de ${formatCRC(summary.creditDiscountTotal)} al credito.`
      );
    }
  } else if (summary.cashDiscountTotal > 0) {
    lines.push(
      `Se aplica un descuento de ${formatCRC(summary.cashDiscountTotal)} al precio contado.`
    );
  } else if (summary.creditDiscountTotal > 0) {
    lines.push(
      `Se aplica un descuento de ${formatCRC(summary.creditDiscountTotal)} al precio credito.`
    );
  }

  if (summary.paymentType === "Credito" && payments.length) {
    const creditTotal = payments.reduce(
      (sum, payment) => sum + toNumber(payment.expectedAmount),
      0
    );
    lines.push(`Total a credito: ${formatCRC(creditTotal)}`);
    lines.push(`Primer pago: ${formatCRC(payments[0].expectedAmount)}`);

    if (creditTotal > 50000 && payments.length > 1) {
      lines.push(
        `Al ser un credito mayor a ${formatCRC(50000)}, el primer pago puede llegar hasta 40%.`
      );
    }

    if (payments.length > 1) {
      lines.push(
        `${payments.length - 1} cuotas de ${formatCRC(
          payments[1]?.expectedAmount || 0
        )} cada una, por quincena.`
      );
    }
  }

  return lines.join("\n");
}

async function buildSalesClientSummary(recordId) {
  const SalesModel = getCustomRecordModel("sales");
  const SaleItemModel = getCustomRecordModel("sale_item");

  const sale = await SalesModel.findById(recordId).lean();
  if (!sale) {
    const error = new Error("Venta no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const items = await SaleItemModel.find({ sale: String(recordId) }).lean();
  const lookups = await loadLookupNames({
    product: items.map((item) => item.product),
  });
  const productNames = lookups.product || new Map();

  const products = items.map((item) => {
    const quantity = toNumber(item.quantity) || 1;
    const lineTotal = toNumber(item.total);
    const originalPrice = toNumber(item.list_price) * quantity || lineTotal + toNumber(item.discount);
    const discountAmount = Math.max(originalPrice - lineTotal, 0);

    return {
      id: String(item._id),
      name: productNames.get(String(item.product)) || "Perfume",
      quantity,
      originalPrice,
      originalPriceFormatted: formatCRC(originalPrice),
      salePrice: lineTotal,
      discountAmount,
      discountAmountFormatted: formatCRC(discountAmount),
    };
  });

  const totalOriginal = products.reduce((sum, product) => sum + product.originalPrice, 0);
  const totalDiscounts = products.reduce((sum, product) => sum + product.discountAmount, 0);
  const totalSale = toNumber(sale.total);
  const totalPaid = toNumber(sale.total_paid);
  const balanceDue = toNumber(sale.balance_due);

  const summary = {
    type: "sales",
    title: `Resumen de pagos - ${sale.name || "Cliente"}`,
    recordId: String(sale._id),
    customerName: sale.name || "",
    products,
    totalOriginal,
    totalOriginalFormatted: formatCRC(totalOriginal),
    totalDiscounts,
    totalDiscountsFormatted: formatCRC(totalDiscounts),
    totalSale,
    totalSaleFormatted: formatCRC(totalSale),
    totalPaid,
    totalPaidFormatted: formatCRC(totalPaid),
    balanceDue,
    balanceDueFormatted: formatCRC(balanceDue),
    paymentStatus: sale.payment_status || "",
    whatsappText: "",
  };

  summary.whatsappText = buildSalesWhatsappText(summary);
  return summary;
}

async function buildQuoteClientSummary(recordId) {
  const QuoteModel = getCustomRecordModel("quote");
  const QuoteItemModel = getCustomRecordModel("quote_item");
  const ProductModel = getCustomRecordModel("product");

  const quote = await QuoteModel.findById(recordId).lean();
  if (!quote) {
    const error = new Error("Cotizacion no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const items = await QuoteItemModel.find({ quote: String(recordId) }).lean();
  const productIds = [...new Set(items.map((item) => String(item.product || "")).filter(Boolean))];
  const productDocs = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }, { name: 1, price: 1 }).lean()
    : [];
  const productMap = new Map(
    productDocs.map((doc) => [String(doc._id), { name: doc.name || "Perfume", price: toNumber(doc.price) }])
  );

  const products = items.map((item) => {
    const quantity = toNumber(item.quantity) || 1;
    const lineTotal = toNumber(item.total);
    const productMeta = productMap.get(String(item.product)) || { name: "Perfume", price: 0 };
    const cashUnitPrice = productMeta.price || toNumber(item.list_price) || toNumber(item.price);
    const creditUnitPrice = toNumber(item.price) || cashUnitPrice;
    const cashLineSubtotal = cashUnitPrice * quantity;
    const creditLineSubtotal = creditUnitPrice * quantity;
    const cashDiscountAmount = getDiscountForScope(
      item.discount_scope,
      item.discount,
      "Contado"
    );
    const creditDiscountAmount = getDiscountForScope(
      item.discount_scope,
      item.discount,
      "Credito"
    );
    const originalPrice = cashLineSubtotal;
    const discountAmount =
      normalizePaymentKeyword(quote.type) === "credito"
        ? creditDiscountAmount
        : cashDiscountAmount;

    return {
      id: String(item._id),
      name: productMeta.name,
      quantity,
      cashUnitPrice,
      cashUnitPriceFormatted: formatCRC(cashUnitPrice),
      cashLineTotal: Math.max(cashLineSubtotal - cashDiscountAmount, 0),
      cashDiscountAmount,
      cashDiscountAmountFormatted: formatCRC(cashDiscountAmount),
      creditLineTotal: Math.max(creditLineSubtotal - creditDiscountAmount, 0),
      creditDiscountAmount,
      creditDiscountAmountFormatted: formatCRC(creditDiscountAmount),
      discountScope: normalizeDiscountScope(item.discount_scope),
      originalPrice,
      originalPriceFormatted: formatCRC(originalPrice),
      salePrice: lineTotal,
      salePriceFormatted: formatCRC(lineTotal),
      discountAmount,
      discountAmountFormatted: formatCRC(discountAmount),
    };
  });

  const totalOriginal = products.reduce((sum, product) => sum + product.originalPrice, 0);
  const totalDiscounts = products.reduce((sum, product) => sum + product.discountAmount, 0);
  const cashTotal = products.reduce((sum, product) => sum + product.cashLineTotal, 0);
  const cashDiscountTotal = products.reduce(
    (sum, product) => sum + product.cashDiscountAmount,
    0
  );
  const creditDiscountTotal = products.reduce(
    (sum, product) => sum + product.creditDiscountAmount,
    0
  );
  const normalizedType = normalizePaymentKeyword(quote.type);
  const payments = calculatePayments({
    total: products.reduce((sum, product) => sum + product.salePrice, 0),
    type: normalizedType === "credito" ? "credito" : "contado",
    creditType: normalizePaymentKeyword(quote.credittype),
    quotes: quote.quotes,
    salesDate: quote.quote_date,
  });

  const summary = {
    type: "quote",
    title: `Cotizacion - ${quote.name || "Cliente"}`,
    recordId: String(quote._id),
    customerName: quote.name || "",
    quoteDate: quote.quote_date || "",
    products,
    totalOriginal,
    totalOriginalFormatted: formatCRC(totalOriginal),
    totalDiscounts,
    totalDiscountsFormatted: formatCRC(totalDiscounts),
    cashTotal,
    cashTotalFormatted: formatCRC(cashTotal),
    cashDiscountTotal,
    cashDiscountTotalFormatted: formatCRC(cashDiscountTotal),
    creditDiscountTotal,
    creditDiscountTotalFormatted: formatCRC(creditDiscountTotal),
    totalSale: payments.reduce((sum, payment) => sum + toNumber(payment.expectedAmount), 0),
    totalSaleFormatted: formatCRC(
      payments.reduce((sum, payment) => sum + toNumber(payment.expectedAmount), 0)
    ),
    creditPreviewTotal: payments.reduce((sum, payment) => sum + toNumber(payment.expectedAmount), 0),
    creditPreviewTotalFormatted: formatCRC(
      payments.reduce((sum, payment) => sum + toNumber(payment.expectedAmount), 0)
    ),
    paymentType: quote.type || "Contado",
    creditType: quote.credittype || "",
    quotes: toNumber(quote.quotes) || 1,
    payments,
    whatsappText: "",
  };

  summary.payments = payments.map((payment) => ({
    ...payment,
    expectedAmountFormatted: formatCRC(payment.expectedAmount),
  }));

  summary.whatsappText = buildQuoteWhatsappText(
    {
      products,
      cashTotal,
      creditTotal: summary.creditPreviewTotal,
      type: quote.type,
    },
    payments
  );

  return summary;
}

async function buildClientSummary(objectApiName, recordId) {
  if (objectApiName === "sales") {
    return buildSalesClientSummary(recordId);
  }

  if (objectApiName === "quote") {
    return buildQuoteClientSummary(recordId);
  }

  const error = new Error("Resumen no soportado para este objeto");
  error.statusCode = 400;
  throw error;
}

module.exports = {
  buildClientSummary,
};

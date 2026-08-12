const { getCustomRecordModel } = require("../models/CustomRecord");

function toQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function createStockError(name, requested, available) {
  const error = new Error(
    `Stock insuficiente para ${name || "el producto"}. Solicitado: ${requested}; disponible: ${available}`
  );
  error.statusCode = 400;
  error.code = "INSUFFICIENT_STOCK";
  return error;
}

async function validateSaleItemStock({ record, previousRecord = null }) {
  const productId = String(record?.product || "");
  const quantity = toQuantity(record?.quantity);
  if (!productId || quantity <= 0) return;

  const ProductModel = getCustomRecordModel("product");
  const product = await ProductModel.findById(productId).lean();
  if (!product) return;

  const previousCompletedQuantity =
    String(previousRecord?.product || "") === productId &&
    previousRecord?.sale_status === "Completada"
      ? toQuantity(previousRecord.quantity)
      : 0;
  const available = Math.max(Number(product.available) || 0, 0) + previousCompletedQuantity;
  if (quantity > available) throw createStockError(product.name, quantity, available);
}

async function validateSaleCompletionStock(saleItems = [], completedStatus = "Completada") {
  const requestedByProduct = new Map();
  for (const item of saleItems) {
    if (item.sale_status === completedStatus) continue;
    const productId = String(item.product || "");
    if (!productId) continue;
    requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + toQuantity(item.quantity));
  }
  if (!requestedByProduct.size) return;

  const ProductModel = getCustomRecordModel("product");
  const products = await ProductModel.find({ _id: { $in: [...requestedByProduct.keys()] } })
    .select("name available")
    .lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  for (const [productId, requested] of requestedByProduct) {
    const product = productMap.get(productId);
    const available = Math.max(Number(product?.available) || 0, 0);
    if (requested > available) throw createStockError(product?.name || productId, requested, available);
  }
}

module.exports = { createStockError, validateSaleItemStock, validateSaleCompletionStock };

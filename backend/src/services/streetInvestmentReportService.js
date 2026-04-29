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

function normalizeId(value) {
  return value ? String(value) : "";
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0%";
  return `${numeric.toFixed(1)}%`;
}

function roundCurrency(value) {
  return Math.round(toNumber(value));
}

function toDate(value) {
  if (!value) return new Date(0);
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function hasLegacyMarker(item = {}) {
  return Boolean(
    item.legacySaleId ||
      item.legacyLineIndex !== undefined ||
      item.legacyProductName ||
      item.legacyProductId
  );
}

function isReliableStockLayer(stock = {}) {
  const unitCost = toNumber(stock.wholesaleprice);
  const purchased = toNumber(stock.purchased);
  if (stock.legacy_inventory_seed === true) return false;
  if (unitCost <= 0 || purchased <= 0) return false;
  if (!Number.isInteger(unitCost)) return false;
  return true;
}

function consumeFifo(layers, quantity) {
  let remaining = toNumber(quantity);
  let totalCost = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const available = toNumber(layer.remaining);
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    layer.remaining -= take;
    remaining -= take;
    totalCost += take * toNumber(layer.unitCost);
  }

  return {
    missingQuantity: remaining,
    totalCost: roundCurrency(totalCost),
  };
}

function getItemTotal(item) {
  return toNumber(item.total) || Math.max(toNumber(item.subtotal) - toNumber(item.discount), 0);
}

function getItemCost(item) {
  const quantity = toNumber(item.quantity) || 1;
  return toNumber(item.cost_snapshot_total) || toNumber(item.cost_snapshot) * quantity;
}

function getOrCreateGroup(groups, productId, product, sellerId, selectedSellerName) {
  if (!groups.has(productId)) {
    groups.set(productId, {
      product_id: productId,
      product_name: product?.name || "Sin producto",
      seller_id: sellerId,
      seller_name: selectedSellerName || "Todos",
      units_in_street: 0,
      sales_count: new Set(),
      street_sale_value: 0,
      street_cost_value: 0,
      street_unrecovered_cost: 0,
      recovered_cost_value: 0,
      collected_value: 0,
      street_balance: 0,
      inventory_units: 0,
      inventory_investment_value: 0,
      inventory_potential_value: 0,
    });
  }

  return groups.get(productId);
}

async function executeStreetInvestmentReport(reportDefinition, options = {}) {
  const SalesModel = getCustomRecordModel("sales");
  const SaleItemModel = getCustomRecordModel("sale_item");
  const ProductModel = getCustomRecordModel("product");
  const SellerModel = getCustomRecordModel("seller");
  const StockModel = getCustomRecordModel("stock");

  const objectDefinition = await CustomObject.findOne({ apiName: "sale_item" }).lean();
  if (!objectDefinition) {
    const error = new Error("Objeto fuente no encontrado: sale_item");
    error.statusCode = 404;
    throw error;
  }

  const sellerId = normalizeId(options.sellerId);

  const sales = await SalesModel.find({})
    .select("name seller_id status total total_paid")
    .lean();

  const openSales = sales.filter((sale) => {
    if (sellerId && normalizeId(sale.seller_id) !== sellerId) return false;
    const status = String(sale.status || "").toLowerCase();
    if (status === "borrador" || status === "cancelada" || status === "cancelado") return false;
    const balance = Math.max(toNumber(sale.total) - toNumber(sale.total_paid), 0);
    return balance > 0;
  });

  const saleMap = new Map(openSales.map((sale) => [String(sale._id), sale]));
  const saleIds = [...saleMap.keys()];

  const saleItems = saleIds.length
    ? await SaleItemModel.find({ sale: { $in: saleIds } })
        .select("sale product quantity price cost_snapshot cost_snapshot_total total subtotal discount sale_status")
        .lean()
    : [];

  const stockRows = await StockModel.find({})
    .select("product wholesaleprice purchased createdAt legacy_inventory_seed")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const realStockRows = stockRows.filter(isReliableStockLayer);
  const stockProductIds = [...new Set(realStockRows.map((stock) => normalizeId(stock.product)).filter(Boolean))];
  const completedSaleItemsForInventory = stockProductIds.length
    ? await SaleItemModel.find({
        product: { $in: stockProductIds },
        sale_status: "Completada",
        legacySaleId: { $exists: false },
      })
        .select("sale product quantity legacySaleId legacyLineIndex legacyProductName legacyProductId createdAt")
        .sort({ product: 1, createdAt: 1, _id: 1 })
        .lean()
    : [];

  const inventorySaleIds = [
    ...new Set(completedSaleItemsForInventory.map((item) => normalizeId(item.sale)).filter(Boolean)),
  ];
  const inventorySales = inventorySaleIds.length
    ? await SalesModel.find({ _id: { $in: inventorySaleIds } })
        .select("saledate createdAt status")
        .lean()
    : [];
  const inventorySaleMap = new Map(inventorySales.map((sale) => [String(sale._id), sale]));

  const productIds = [
    ...new Set(
      [
        ...saleItems.map((item) => normalizeId(item.product)),
        ...realStockRows.map((stock) => normalizeId(stock.product)),
      ].filter(Boolean)
    ),
  ];
  const sellerIds = [...new Set(openSales.map((sale) => normalizeId(sale.seller_id)).filter(Boolean))];

  const [products, sellers] = await Promise.all([
    productIds.length
      ? ProductModel.find({ _id: { $in: productIds } })
          .select("name brand price available purchaseditems sold")
          .lean()
      : [],
    sellerIds.length ? SellerModel.find({ _id: { $in: sellerIds } }).select("name").lean() : [],
  ]);

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller.name || "Sin vendedor"]));
  const selectedSellerName = sellerId ? sellerMap.get(sellerId) || "" : "";
  const groups = new Map();
  const layersByProduct = new Map();

  for (const stock of realStockRows) {
    const productId = normalizeId(stock.product);
    if (!productId) continue;
    if (!layersByProduct.has(productId)) layersByProduct.set(productId, []);
    layersByProduct.get(productId).push({
      remaining: toNumber(stock.purchased),
      unitCost: toNumber(stock.wholesaleprice),
      createdAt: stock.createdAt,
    });
  }

  const inventoryItemsByProduct = new Map();
  for (const item of completedSaleItemsForInventory) {
    if (hasLegacyMarker(item)) continue;
    const productId = normalizeId(item.product);
    if (!productId) continue;
    const sale = inventorySaleMap.get(normalizeId(item.sale));
    const status = String(sale?.status || "").toLowerCase();
    if (!sale || status === "cancelada" || status === "cancelado") continue;
    if (!inventoryItemsByProduct.has(productId)) inventoryItemsByProduct.set(productId, []);
    inventoryItemsByProduct.get(productId).push(item);
  }

  for (const [productId, layers] of layersByProduct.entries()) {
    const items = inventoryItemsByProduct.get(productId) || [];
    const orderedItems = [...items].sort((left, right) => {
      const leftSale = inventorySaleMap.get(normalizeId(left.sale));
      const rightSale = inventorySaleMap.get(normalizeId(right.sale));
      const leftDate = toDate(leftSale?.saledate || leftSale?.createdAt || left.createdAt).getTime();
      const rightDate = toDate(rightSale?.saledate || rightSale?.createdAt || right.createdAt).getTime();
      if (leftDate !== rightDate) return leftDate - rightDate;
      return String(left._id).localeCompare(String(right._id));
    });

    const remainingLayers = layers.map((layer) => ({ ...layer }));
    for (const item of orderedItems) {
      consumeFifo(remainingLayers, toNumber(item.quantity) || 1);
    }

    const inventoryUnits = remainingLayers.reduce((sum, layer) => sum + toNumber(layer.remaining), 0);
    if (inventoryUnits <= 0) continue;

    const product = productMap.get(productId);
    const inventoryInvestment = remainingLayers.reduce(
      (sum, layer) => sum + toNumber(layer.remaining) * toNumber(layer.unitCost),
      0
    );
    const group = getOrCreateGroup(groups, productId, product, sellerId, selectedSellerName);
    group.inventory_units = inventoryUnits;
    group.inventory_investment_value = inventoryInvestment;
    group.inventory_potential_value = inventoryUnits * toNumber(product?.price);
  }

  for (const item of saleItems) {
    const sale = saleMap.get(normalizeId(item.sale));
    if (!sale) continue;

    const productId = normalizeId(item.product) || "sin_producto";
    const product = productMap.get(productId);
    const quantity = toNumber(item.quantity) || 1;
    const itemTotal = getItemTotal(item);
    const itemCost = getItemCost(item);
    const saleTotal = toNumber(sale.total);
    const salePaid = toNumber(sale.total_paid);
    const saleBalance = Math.max(saleTotal - salePaid, 0);
    const allocationRatio = saleTotal > 0 ? itemTotal / saleTotal : 0;
    const collectedAllocated = Math.min(itemTotal, Math.max(salePaid * allocationRatio, 0));
    const streetBalance = Math.min(itemTotal, Math.max(saleBalance * allocationRatio, 0));
    const recoveredCost = Math.min(itemCost, collectedAllocated);
    const unrecoveredCost = Math.max(itemCost - collectedAllocated, 0);
    const group = getOrCreateGroup(groups, productId, product, sellerId, selectedSellerName);
    group.units_in_street += quantity;
    group.sales_count.add(normalizeId(sale._id));
    group.street_sale_value += itemTotal;
    group.street_cost_value += itemCost;
    group.recovered_cost_value += recoveredCost;
    group.street_unrecovered_cost += unrecoveredCost;
    group.collected_value += collectedAllocated;
    group.street_balance += streetBalance;
  }

  const rows = [...groups.values()]
    .map((group) => {
      const investmentValue = group.street_unrecovered_cost + group.inventory_investment_value;
      const potentialValue = group.street_balance + group.inventory_potential_value;
      const expectedProfit = potentialValue - investmentValue;
      const streetExpectedProfit = group.street_sale_value - group.street_cost_value;
      const streetPendingProfit = group.street_balance - group.street_unrecovered_cost;
      const inventoryExpectedProfit = group.inventory_potential_value - group.inventory_investment_value;
      const recoveryPercent =
        group.street_sale_value > 0 ? (group.collected_value / group.street_sale_value) * 100 : 0;
      const costRecoveryPercent =
        group.street_cost_value > 0 ? (group.recovered_cost_value / group.street_cost_value) * 100 : 0;

      return {
        product_id: group.product_id,
        product_name: group.product_name,
        seller_id: group.seller_id,
        seller_name: group.seller_name,
        units_in_street: group.units_in_street,
        sales_count: group.sales_count.size,
        street_sale_value: Math.round(group.street_sale_value),
        street_sale_value_formatted: formatCurrency(group.street_sale_value),
        street_cost_value: Math.round(group.street_cost_value),
        street_cost_value_formatted: formatCurrency(group.street_cost_value),
        street_unrecovered_cost: Math.round(group.street_unrecovered_cost),
        street_unrecovered_cost_formatted: formatCurrency(group.street_unrecovered_cost),
        recovered_cost_value: Math.round(group.recovered_cost_value),
        recovered_cost_value_formatted: formatCurrency(group.recovered_cost_value),
        inventory_units: group.inventory_units,
        inventory_investment_value: Math.round(group.inventory_investment_value),
        inventory_investment_value_formatted: formatCurrency(group.inventory_investment_value),
        inventory_potential_value: Math.round(group.inventory_potential_value),
        inventory_potential_value_formatted: formatCurrency(group.inventory_potential_value),
        investment_value: Math.round(investmentValue),
        investment_value_formatted: formatCurrency(investmentValue),
        potential_value: Math.round(potentialValue),
        potential_value_formatted: formatCurrency(potentialValue),
        expected_profit: Math.round(expectedProfit),
        expected_profit_formatted: formatCurrency(expectedProfit),
        street_expected_profit: Math.round(streetExpectedProfit),
        street_expected_profit_formatted: formatCurrency(streetExpectedProfit),
        street_pending_profit: Math.round(streetPendingProfit),
        street_pending_profit_formatted: formatCurrency(streetPendingProfit),
        inventory_expected_profit: Math.round(inventoryExpectedProfit),
        inventory_expected_profit_formatted: formatCurrency(inventoryExpectedProfit),
        collected_value: Math.round(group.collected_value),
        collected_value_formatted: formatCurrency(group.collected_value),
        street_balance: Math.round(group.street_balance),
        street_balance_formatted: formatCurrency(group.street_balance),
        recovery_percent: recoveryPercent,
        recovery_percent_formatted: formatPercent(recoveryPercent),
        cost_recovery_percent: costRecoveryPercent,
        cost_recovery_percent_formatted: formatPercent(costRecoveryPercent),
      };
    })
    .filter((row) => row.units_in_street > 0 || row.inventory_units > 0)
    .sort((left, right) => right.investment_value - left.investment_value);

  const summary = rows.reduce(
    (acc, row) => {
      acc.units_in_street += row.units_in_street;
      acc.inventory_units += row.inventory_units;
      acc.sales_count += row.sales_count;
      acc.street_sale_value += row.street_sale_value;
      acc.street_cost_value += row.street_cost_value;
      acc.street_unrecovered_cost += row.street_unrecovered_cost;
      acc.recovered_cost_value += row.recovered_cost_value;
      acc.inventory_investment_value += row.inventory_investment_value;
      acc.inventory_potential_value += row.inventory_potential_value;
      acc.investment_value += row.investment_value;
      acc.potential_value += row.potential_value;
      acc.expected_profit += row.expected_profit;
      acc.street_expected_profit += row.street_expected_profit;
      acc.street_pending_profit += row.street_pending_profit;
      acc.inventory_expected_profit += row.inventory_expected_profit;
      acc.collected_value += row.collected_value;
      acc.street_balance += row.street_balance;
      return acc;
    },
    {
      rows_count: rows.length,
      units_in_street: 0,
      inventory_units: 0,
      sales_count: 0,
      street_sale_value: 0,
      street_cost_value: 0,
      street_unrecovered_cost: 0,
      recovered_cost_value: 0,
      inventory_investment_value: 0,
      inventory_potential_value: 0,
      investment_value: 0,
      potential_value: 0,
      expected_profit: 0,
      street_expected_profit: 0,
      street_pending_profit: 0,
      inventory_expected_profit: 0,
      collected_value: 0,
      street_balance: 0,
    }
  );

  summary.street_sale_value_formatted = formatCurrency(summary.street_sale_value);
  summary.street_cost_value_formatted = formatCurrency(summary.street_cost_value);
  summary.street_unrecovered_cost_formatted = formatCurrency(summary.street_unrecovered_cost);
  summary.recovered_cost_value_formatted = formatCurrency(summary.recovered_cost_value);
  summary.inventory_investment_value_formatted = formatCurrency(summary.inventory_investment_value);
  summary.inventory_potential_value_formatted = formatCurrency(summary.inventory_potential_value);
  summary.investment_value_formatted = formatCurrency(summary.investment_value);
  summary.potential_value_formatted = formatCurrency(summary.potential_value);
  summary.expected_profit_formatted = formatCurrency(summary.expected_profit);
  summary.street_expected_profit_formatted = formatCurrency(summary.street_expected_profit);
  summary.street_pending_profit_formatted = formatCurrency(summary.street_pending_profit);
  summary.inventory_expected_profit_formatted = formatCurrency(summary.inventory_expected_profit);
  summary.collected_value_formatted = formatCurrency(summary.collected_value);
  summary.street_balance_formatted = formatCurrency(summary.street_balance);
  summary.recovery_percent =
    summary.street_sale_value > 0 ? (summary.collected_value / summary.street_sale_value) * 100 : 0;
  summary.recovery_percent_formatted = formatPercent(summary.recovery_percent);
  summary.cost_recovery_percent =
    summary.street_cost_value > 0 ? (summary.recovered_cost_value / summary.street_cost_value) * 100 : 0;
  summary.cost_recovery_percent_formatted = formatPercent(summary.cost_recovery_percent);

  return {
    viewType: "street_investment",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: objectDefinition.name,
    totalSourceRecords: rows.length,
    filters: {
      sellerId,
      sellerName: selectedSellerName,
    },
    columns: [
      { id: "product_name", label: "Producto", type: "text" },
      { id: "seller_name", label: "Filtro vendedor", type: "text" },
      { id: "units_in_street", label: "Unidades calle", type: "number" },
      { id: "sales_count", label: "Ventas", type: "number" },
      { id: "street_sale_value_formatted", label: "Valor en calle", type: "text" },
      { id: "street_cost_value_formatted", label: "Costo calle", type: "text" },
      { id: "street_unrecovered_cost_formatted", label: "Costo no recuperado", type: "text" },
      { id: "collected_value_formatted", label: "Cobrado", type: "text" },
      { id: "street_balance_formatted", label: "Pendiente", type: "text" },
      { id: "inventory_units", label: "Unidades inventario", type: "number" },
      { id: "inventory_investment_value_formatted", label: "Inversion inventario", type: "text" },
      { id: "inventory_potential_value_formatted", label: "Potencial inventario", type: "text" },
      { id: "investment_value_formatted", label: "Inversion total", type: "text" },
      { id: "potential_value_formatted", label: "Potencial total", type: "text" },
      { id: "expected_profit_formatted", label: "Utilidad esperada", type: "text" },
      { id: "cost_recovery_percent_formatted", label: "% costo recuperado", type: "text" },
    ],
    rows,
    summary,
  };
}

module.exports = {
  executeStreetInvestmentReport,
};

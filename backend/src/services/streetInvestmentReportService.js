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

function getComputedAvailable(product) {
  return Math.max(toNumber(product?.purchaseditems) - toNumber(product?.sold), 0);
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
        .select("sale product quantity price cost_snapshot total subtotal discount sale_status")
        .lean()
    : [];

  const stockRows = await StockModel.find({})
    .select("product wholesaleprice purchased createdAt")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const productIds = [
    ...new Set(
      [
        ...saleItems.map((item) => normalizeId(item.product)),
        ...stockRows.map((stock) => normalizeId(stock.product)),
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

  for (const stock of stockRows) {
    const productId = normalizeId(stock.product);
    if (!productId) continue;
    const product = productMap.get(productId);
    const availableUnits = getComputedAvailable(product);
    if (availableUnits <= 0) continue;

    if (!groups.has(productId)) {
      groups.set(productId, {
        product_id: productId,
        product_name: product?.name || stock.name || "Sin producto",
        seller_id: sellerId,
        seller_name: selectedSellerName || "Todos",
        units_in_street: 0,
        sales_count: new Set(),
        street_sale_value: 0,
        street_investment_value: 0,
        collected_value: 0,
        street_balance: 0,
        stock_purchased_units: 0,
        stock_purchased_investment: 0,
        inventory_units: availableUnits,
        inventory_investment_value: 0,
        inventory_potential_value: availableUnits * toNumber(product?.price),
      });
    }

    const group = groups.get(productId);
    group.stock_purchased_units += toNumber(stock.purchased);
    group.stock_purchased_investment += toNumber(stock.wholesaleprice) * toNumber(stock.purchased);
  }

  for (const group of groups.values()) {
    const averageStockCost =
      group.stock_purchased_units > 0
        ? group.stock_purchased_investment / group.stock_purchased_units
        : 0;
    group.inventory_investment_value = group.inventory_units * averageStockCost;
  }

  for (const item of saleItems) {
    const sale = saleMap.get(normalizeId(item.sale));
    if (!sale) continue;

    const productId = normalizeId(item.product) || "sin_producto";
    const product = productMap.get(productId);
    const quantity = toNumber(item.quantity) || 1;
    const itemTotal = toNumber(item.total) || Math.max(toNumber(item.subtotal) - toNumber(item.discount), 0);
    const itemInvestment = toNumber(item.cost_snapshot) * quantity;
    const saleTotal = toNumber(sale.total);
    const salePaid = toNumber(sale.total_paid);
    const saleBalance = Math.max(saleTotal - salePaid, 0);
    const allocationRatio = saleTotal > 0 ? itemTotal / saleTotal : 0;
    const collectedAllocated = Math.min(itemTotal, Math.max(salePaid * allocationRatio, 0));
    const streetBalance = Math.min(itemTotal, Math.max(saleBalance * allocationRatio, 0));

    if (!groups.has(productId)) {
      groups.set(productId, {
        product_id: productId,
        product_name: product?.name || "Sin producto",
        seller_id: sellerId,
        seller_name: selectedSellerName || "Todos",
        units_in_street: 0,
        sales_count: new Set(),
        street_sale_value: 0,
        street_investment_value: 0,
        collected_value: 0,
        street_balance: 0,
        stock_purchased_units: 0,
        stock_purchased_investment: 0,
        inventory_units: getComputedAvailable(product),
        inventory_investment_value: 0,
        inventory_potential_value: getComputedAvailable(product) * toNumber(product?.price),
      });
    }

    const group = groups.get(productId);
    group.units_in_street += quantity;
    group.sales_count.add(normalizeId(sale._id));
    group.street_sale_value += itemTotal;
    group.street_investment_value += itemInvestment;
    group.collected_value += collectedAllocated;
    group.street_balance += streetBalance;
  }

  const rows = [...groups.values()]
    .map((group) => {
      const investmentValue = group.street_investment_value + group.inventory_investment_value;
      const potentialValue = group.street_sale_value + group.inventory_potential_value;
      const expectedProfit = potentialValue - investmentValue;
      const recoveryPercent =
        group.street_sale_value > 0 ? (group.collected_value / group.street_sale_value) * 100 : 0;
      const exposureOverInvestment =
        investmentValue > 0 ? ((group.street_balance + group.inventory_investment_value) / investmentValue) * 100 : 0;

      return {
        product_id: group.product_id,
        product_name: group.product_name,
        seller_id: group.seller_id,
        seller_name: group.seller_name,
        units_in_street: group.units_in_street,
        sales_count: group.sales_count.size,
        street_sale_value: Math.round(group.street_sale_value),
        street_sale_value_formatted: formatCurrency(group.street_sale_value),
        street_investment_value: Math.round(group.street_investment_value),
        street_investment_value_formatted: formatCurrency(group.street_investment_value),
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
        collected_value: Math.round(group.collected_value),
        collected_value_formatted: formatCurrency(group.collected_value),
        street_balance: Math.round(group.street_balance),
        street_balance_formatted: formatCurrency(group.street_balance),
        recovery_percent: recoveryPercent,
        recovery_percent_formatted: formatPercent(recoveryPercent),
        exposure_over_investment: exposureOverInvestment,
        exposure_over_investment_formatted: formatPercent(exposureOverInvestment),
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
      acc.street_investment_value += row.street_investment_value;
      acc.inventory_investment_value += row.inventory_investment_value;
      acc.inventory_potential_value += row.inventory_potential_value;
      acc.investment_value += row.investment_value;
      acc.potential_value += row.potential_value;
      acc.expected_profit += row.expected_profit;
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
      street_investment_value: 0,
      inventory_investment_value: 0,
      inventory_potential_value: 0,
      investment_value: 0,
      potential_value: 0,
      expected_profit: 0,
      collected_value: 0,
      street_balance: 0,
    }
  );

  summary.street_sale_value_formatted = formatCurrency(summary.street_sale_value);
  summary.street_investment_value_formatted = formatCurrency(summary.street_investment_value);
  summary.inventory_investment_value_formatted = formatCurrency(summary.inventory_investment_value);
  summary.inventory_potential_value_formatted = formatCurrency(summary.inventory_potential_value);
  summary.investment_value_formatted = formatCurrency(summary.investment_value);
  summary.potential_value_formatted = formatCurrency(summary.potential_value);
  summary.expected_profit_formatted = formatCurrency(summary.expected_profit);
  summary.collected_value_formatted = formatCurrency(summary.collected_value);
  summary.street_balance_formatted = formatCurrency(summary.street_balance);

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
      { id: "street_investment_value_formatted", label: "Inversion calle", type: "text" },
      { id: "expected_profit_formatted", label: "Utilidad esperada", type: "text" },
      { id: "collected_value_formatted", label: "Cobrado", type: "text" },
      { id: "street_balance_formatted", label: "Pendiente", type: "text" },
      { id: "inventory_units", label: "Unidades inventario", type: "number" },
      { id: "inventory_investment_value_formatted", label: "Inversion inventario", type: "text" },
      { id: "inventory_potential_value_formatted", label: "Potencial inventario", type: "text" },
      { id: "investment_value_formatted", label: "Inversion total", type: "text" },
      { id: "potential_value_formatted", label: "Potencial total", type: "text" },
      { id: "recovery_percent_formatted", label: "% cobrado", type: "text" },
    ],
    rows,
    summary,
  };
}

module.exports = {
  executeStreetInvestmentReport,
};

const { getCustomRecordModel } = require("../models/CustomRecord");

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeId(value) {
  return value ? String(value) : "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function consumeLayers(layers, quantity) {
  let pending = Math.max(toNumber(quantity), 0);
  let cost = 0;
  for (const layer of layers) {
    if (pending <= 0) break;
    const take = Math.min(Math.max(toNumber(layer.remaining), 0), pending);
    layer.remaining -= take;
    pending -= take;
    cost += take * toNumber(layer.unitCost);
  }
  return { cost, missingUnits: pending };
}

function buildInventoryReconciliationRows({ products = [], stocks = [], saleItems = [], sales = [] }) {
  const productMap = new Map(products.map((product) => [normalizeId(product._id), product]));
  const saleMap = new Map(sales.map((sale) => [normalizeId(sale._id), sale]));
  const groups = new Map();
  const getGroup = (productId) => {
    if (!groups.has(productId)) {
      groups.set(productId, { stocks: [], items: [] });
    }
    return groups.get(productId);
  };

  for (const stock of stocks) {
    const productId = normalizeId(stock.product);
    if (productId) getGroup(productId).stocks.push(stock);
  }
  for (const item of saleItems) {
    const productId = normalizeId(item.product);
    if (productId) getGroup(productId).items.push(item);
  }

  return [...groups.entries()].map(([productId, group]) => {
    const orderedStocks = [...group.stocks].sort((a, b) =>
      String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id))
    );
    const orderedItems = [...group.items].sort((a, b) =>
      String(a.createdAt || a._id).localeCompare(String(b.createdAt || b._id))
    );
    const layers = orderedStocks.map((stock) => ({
      remaining: Math.max(toNumber(stock.purchased), 0),
      unitCost: Math.max(toNumber(stock.wholesaleprice), 0),
    }));
    const purchasedUnits = layers.reduce((sum, layer) => sum + layer.remaining, 0);
    const purchaseValue = layers.reduce(
      (sum, layer) => sum + layer.remaining * layer.unitCost,
      0
    );
    const soldUnits = orderedItems.reduce(
      (sum, item) => sum + Math.max(toNumber(item.quantity), 0),
      0
    );
    const recordedSoldCost = orderedItems.reduce((sum, item) => {
      const quantity = Math.max(toNumber(item.quantity), 0);
      return sum + (toNumber(item.cost_snapshot_total) || toNumber(item.cost_snapshot) * quantity);
    }, 0);
    let fifoSoldCost = 0;
    let unbackedSoldUnits = 0;
    const affectedSales = [];
    for (const item of orderedItems) {
      const consumed = consumeLayers(layers, item.quantity);
      fifoSoldCost += consumed.cost;
      unbackedSoldUnits += consumed.missingUnits;
      const quantity = Math.max(toNumber(item.quantity), 0);
      const recordedCost = toNumber(item.cost_snapshot_total) || toNumber(item.cost_snapshot) * quantity;
      const itemDifference = recordedCost - consumed.cost;
      if (consumed.missingUnits > 0 || Math.abs(itemDifference) >= 1) {
        const saleId = normalizeId(item.sale);
        const sale = saleMap.get(saleId) || {};
        affectedSales.push({
          sale_id: saleId,
          sale_name: sale.name || saleId || "Venta sin identificar",
          sale_date: sale.saledate || sale.createdAt || "",
          sale_item_id: normalizeId(item._id),
          quantity,
          recorded_cost: Math.round(recordedCost),
          fifo_cost: Math.round(consumed.cost),
          cost_difference: Math.round(itemDifference),
          unbacked_units: consumed.missingUnits,
        });
      }
    }
    const fifoRemainingUnits = layers.reduce((sum, layer) => sum + layer.remaining, 0);
    const fifoRemainingValue = layers.reduce(
      (sum, layer) => sum + layer.remaining * layer.unitCost,
      0
    );
    const product = productMap.get(productId) || {};
    const systemAvailableUnits = Math.max(toNumber(product.available), 0);
    const unitDifference = systemAvailableUnits - fifoRemainingUnits;
    const costDifference = recordedSoldCost - fifoSoldCost;
    const hasDifference = unbackedSoldUnits > 0 || unitDifference !== 0 || Math.abs(costDifference) >= 1;

    return {
      product_id: productId,
      product_name: product.name || "Producto sin nombre",
      purchased_units: purchasedUnits,
      purchase_value: Math.round(purchaseValue),
      purchase_value_formatted: formatCurrency(purchaseValue),
      sold_units: soldUnits,
      recorded_sold_cost: Math.round(recordedSoldCost),
      recorded_sold_cost_formatted: formatCurrency(recordedSoldCost),
      fifo_sold_cost: Math.round(fifoSoldCost),
      fifo_sold_cost_formatted: formatCurrency(fifoSoldCost),
      cost_difference: Math.round(costDifference),
      cost_difference_formatted: formatCurrency(costDifference),
      fifo_remaining_units: fifoRemainingUnits,
      system_available_units: systemAvailableUnits,
      unit_difference: unitDifference,
      fifo_remaining_value: Math.round(fifoRemainingValue),
      fifo_remaining_value_formatted: formatCurrency(fifoRemainingValue),
      unbacked_sold_units: unbackedSoldUnits,
      affected_sales: affectedSales,
      affected_sales_count: affectedSales.length,
      affected_sales_label: affectedSales.length
        ? affectedSales.map((entry) => `${entry.sale_name} (${entry.sale_id})`).join(" | ")
        : "-",
      status: hasDifference ? "Revisar" : "Conciliado",
      has_difference: hasDifference,
    };
  }).sort((a, b) => {
    if (a.has_difference !== b.has_difference) return a.has_difference ? -1 : 1;
    return Math.abs(b.cost_difference) - Math.abs(a.cost_difference);
  });
}

async function executeInventoryReconciliationReport(reportDefinition, options = {}) {
  const ProductModel = getCustomRecordModel("product");
  const StockModel = getCustomRecordModel("stock");
  const SaleItemModel = getCustomRecordModel("sale_item");
  const SalesModel = getCustomRecordModel("sales");
  const onlyDifferences = String(options.onlyDifferences || "true") !== "false";

  const [products, stocks, saleItems] = await Promise.all([
    ProductModel.find({}).select("name available purchaseditems sold").lean(),
    StockModel.find({ purchased: { $gt: 0 } })
      .select("product purchased wholesaleprice legacy_inventory_seed createdAt")
      .lean(),
    SaleItemModel.find({ sale_status: { $ne: "Cancelada" } })
      .select("sale product quantity cost_snapshot cost_snapshot_total createdAt sale_status")
      .lean(),
  ]);
  const saleIds = [...new Set(saleItems.map((item) => normalizeId(item.sale)).filter(Boolean))];
  const sales = saleIds.length
    ? await SalesModel.find({ _id: { $in: saleIds } }).select("name saledate createdAt").lean()
    : [];

  const allRows = buildInventoryReconciliationRows({ products, stocks, saleItems, sales });
  const rows = onlyDifferences ? allRows.filter((row) => row.has_difference) : allRows;
  const summary = allRows.reduce((result, row) => {
    result.products += 1;
    result.products_with_differences += row.has_difference ? 1 : 0;
    result.purchase_value += row.purchase_value;
    result.recorded_sold_cost += row.recorded_sold_cost;
    result.fifo_sold_cost += row.fifo_sold_cost;
    result.cost_difference += row.cost_difference;
    result.fifo_remaining_value += row.fifo_remaining_value;
    result.unbacked_sold_units += row.unbacked_sold_units;
    result.unit_difference += row.unit_difference;
    return result;
  }, {
    products: 0,
    products_with_differences: 0,
    purchase_value: 0,
    recorded_sold_cost: 0,
    fifo_sold_cost: 0,
    cost_difference: 0,
    fifo_remaining_value: 0,
    unbacked_sold_units: 0,
    unit_difference: 0,
  });
  for (const field of ["purchase_value", "recorded_sold_cost", "fifo_sold_cost", "cost_difference", "fifo_remaining_value"]) {
    summary[`${field}_formatted`] = formatCurrency(summary[field]);
  }

  return {
    viewType: "inventory_reconciliation",
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: "stock",
    sourceObjectLabel: "Conciliacion de inventario",
    totalSourceRecords: allRows.length,
    filters: { onlyDifferences },
    columns: [
      { id: "product_name", label: "Producto", type: "text" },
      { id: "status", label: "Estado", type: "text" },
      { id: "purchased_units", label: "Compradas", type: "number" },
      { id: "sold_units", label: "Vendidas", type: "number" },
      { id: "fifo_remaining_units", label: "Restante FIFO", type: "number" },
      { id: "system_available_units", label: "Disponible sistema", type: "number" },
      { id: "unit_difference", label: "Dif. unidades", type: "number" },
      { id: "unbacked_sold_units", label: "Vendidas sin compra", type: "number" },
      { id: "affected_sales_label", label: "Ventas afectadas (nombre e ID)", type: "text" },
      { id: "purchase_value_formatted", label: "Valor compras", type: "text" },
      { id: "recorded_sold_cost_formatted", label: "Costo ventas guardado", type: "text" },
      { id: "fifo_sold_cost_formatted", label: "Costo ventas FIFO", type: "text" },
      { id: "cost_difference_formatted", label: "Diferencia costo", type: "text" },
      { id: "fifo_remaining_value_formatted", label: "Inventario restante", type: "text" },
    ],
    rows,
    summary,
    notes: [
      "FIFO distribuye las compras registradas desde el lote mas antiguo hacia las ventas.",
      "Vendidas sin compra indica unidades cuyo costo no puede respaldarse con ningun lote registrado.",
      "Diferencia costo compara el cost_snapshot de las ventas contra el costo FIFO de las compras.",
      "Este reporte es de diagnostico y no modifica existencias ni costos.",
    ],
  };
}

module.exports = {
  buildInventoryReconciliationRows,
  executeInventoryReconciliationReport,
};

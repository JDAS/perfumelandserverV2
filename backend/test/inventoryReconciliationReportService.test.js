const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

const { buildInventoryReconciliationRows } = loadWithMocks(
  "src/services/inventoryReconciliationReportService.js",
  { "../models/CustomRecord": { getCustomRecordModel: () => ({}) } }
);

test("inventory reconciliation values purchases and remaining stock with FIFO", () => {
  const [row] = buildInventoryReconciliationRows({
    products: [{ _id: "p1", name: "Perfume", available: 2 }],
    stocks: [
      { _id: "a", product: "p1", purchased: 2, wholesaleprice: 10000, createdAt: "2026-01-01" },
      { _id: "b", product: "p1", purchased: 2, wholesaleprice: 12000, createdAt: "2026-02-01" },
    ],
    saleItems: [
      { _id: "s1", product: "p1", quantity: 2, cost_snapshot: 10000, createdAt: "2026-03-01" },
    ],
  });
  assert.equal(row.purchase_value, 44000);
  assert.equal(row.fifo_sold_cost, 20000);
  assert.equal(row.fifo_remaining_value, 24000);
  assert.equal(row.unit_difference, 0);
  assert.equal(row.status, "Conciliado");
});

test("inventory reconciliation flags sales without supporting purchases", () => {
  const [row] = buildInventoryReconciliationRows({
    products: [{ _id: "p1", name: "Perfume", available: 0 }],
    stocks: [{ _id: "a", product: "p1", purchased: 1, wholesaleprice: 10000 }],
    saleItems: [{ _id: "s1", product: "p1", quantity: 2, cost_snapshot: 12000 }],
  });
  assert.equal(row.unbacked_sold_units, 1);
  assert.equal(row.recorded_sold_cost, 24000);
  assert.equal(row.fifo_sold_cost, 10000);
  assert.equal(row.cost_difference, 14000);
  assert.equal(row.status, "Revisar");
});

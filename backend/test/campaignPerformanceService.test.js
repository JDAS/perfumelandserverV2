const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { buildCampaignPerformanceRows } = require("../src/services/campaignPerformanceService");

test("campaign performance deduplicates sales linked to multiple participants", () => {
  const [row] = buildCampaignPerformanceRows({
    campaigns: [{ _id: "c1", name: "Campaña", entry_start: 0, entry_end: 99 }],
    links: [
      { campaign_id: "c1", sale_id: "s1", status: "Activa" },
      { campaign_id: "c1", sale_id: "s1", status: "Activa" },
    ],
    participants: [
      { campaign_id: "c1", status: "Activo" },
      { campaign_id: "c1", status: "Activo" },
    ],
    entries: [{ campaign_id: "c1", status: "Activa" }],
    sales: [{ _id: "s1", status: "Completada", total: 22000, total_paid: 10000 }],
    saleItems: [
      { sale: "s1", quantity: 1, total: 22000, cost_snapshot: 13500 },
    ],
  });

  assert.equal(row.linked_sales, 1);
  assert.equal(row.sales_total, 22000);
  assert.equal(row.gross_profit, 8500);
  assert.equal(row.participants, 2);
  assert.equal(row.entry_progress, 1);
});

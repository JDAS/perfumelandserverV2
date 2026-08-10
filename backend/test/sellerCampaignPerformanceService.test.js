const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { buildSellerCampaignRows } = require("../src/services/sellerCampaignPerformanceService");

test("seller campaign performance groups by seller and campaign without duplicating sales", () => {
  const rows = buildSellerCampaignRows({
    sellers: [{ _id: "seller-1", name: "Ana" }],
    campaigns: [{ _id: "campaign-1", name: "Navidad", status: "Activa" }],
    sales: [{ _id: "sale-1", seller_id: "seller-1", total: 30000, total_paid: 20000, commission_amount: 5000 }],
    links: [
      { sale_id: "sale-1", campaign_id: "campaign-1", participant_id: "participant-1", status: "Activa" },
      { sale_id: "sale-1", campaign_id: "campaign-1", participant_id: "participant-1", status: "Activa" },
    ],
    entries: [
      { sale_id: "sale-1", campaign_id: "campaign-1" },
      { sale_id: "sale-1", campaign_id: "campaign-1" },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].seller_id__label, "Ana");
  assert.equal(rows[0].linked_sales, 1);
  assert.equal(rows[0].sales_total, 30000);
  assert.equal(rows[0].participants, 1);
  assert.equal(rows[0].assigned_entries, 2);
});

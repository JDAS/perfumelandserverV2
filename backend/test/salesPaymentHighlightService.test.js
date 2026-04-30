const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("buildSalesPaymentHighlights prioritizes paid, overdue, and due soon states", async () => {
  const models = {
    sales: {
      find: () => ({
        select: () => ({
          lean: async () => [
            { _id: "paid-sale", total: 10000, total_paid: 10000, balance_due: 0 },
            { _id: "overdue-sale", total: 20000, total_paid: 5000, balance_due: 15000 },
            { _id: "soon-sale", total: 30000, total_paid: 10000, balance_due: 20000 },
            { _id: "open-sale", total: 40000, total_paid: 10000, balance_due: 30000 },
          ],
        }),
      }),
    },
    payment_plan: {
      find: () => ({
        select: () => ({
          lean: async () => {
            const today = new Date();
            const overdue = new Date(today);
            overdue.setDate(today.getDate() - 1);
            const soon = new Date(today);
            soon.setDate(today.getDate() + 2);
            const later = new Date(today);
            later.setDate(today.getDate() + 10);

            return [
              { sale_id: "overdue-sale", due_date: overdue, planned_amount: 15000, paid_amount: 0 },
              { sale_id: "soon-sale", due_date: soon, planned_amount: 20000, paid_amount: 0 },
              { sale_id: "open-sale", due_date: later, planned_amount: 30000, paid_amount: 0 },
            ];
          },
        }),
      }),
    },
  };

  const service = loadWithMocks("src/services/salesPaymentHighlightService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
  });

  const highlights = await service.buildSalesPaymentHighlights(
    "paid-sale,overdue-sale,soon-sale,open-sale"
  );

  assert.equal(highlights["paid-sale"].status, "paid");
  assert.equal(highlights["overdue-sale"].status, "overdue");
  assert.equal(highlights["soon-sale"].status, "due_soon");
  assert.equal(highlights["open-sale"].status, "open");
});

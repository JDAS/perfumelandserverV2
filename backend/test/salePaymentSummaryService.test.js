const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("buildSalePaymentSummary includes overdue and next payment whatsapp text", async () => {
  const models = {
    sales: {
      findById: () => ({
        lean: async () => ({
          _id: "sale-1",
          name: "Cliente demo",
          total: 62000,
          total_paid: 40000,
          balance_due: 22000,
        }),
      }),
    },
    sale_item: {
      find: () => ({
        lean: async () => [
          { _id: "item-1", product: "product-1", quantity: 1, total: 31000, discount: 0 },
          { _id: "item-2", product: "product-2", quantity: 1, total: 31000, discount: 0 },
        ],
      }),
    },
    product: {
      find: () => ({
        select: () => ({
          lean: async () => [
            { _id: "product-1", name: "360 Red for Women" },
            { _id: "product-2", name: "360 Coral" },
          ],
        }),
      }),
    },
    payment_plan: {
      find: () => ({
        sort: () => ({
          lean: async () => [
            {
              _id: "plan-1",
              installment_number: 1,
              due_date: "2026-04-15",
              planned_amount: 11000,
              paid_amount: 0,
            },
            {
              _id: "plan-2",
              installment_number: 2,
              due_date: "2999-04-30",
              planned_amount: 11000,
              paid_amount: 0,
            },
          ],
        }),
      }),
    },
  };

  const service = loadWithMocks("src/services/salePaymentSummaryService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
  });

  const summary = await service.buildSalePaymentSummary("sale-1");

  assert.equal(summary.products.length, 2);
  assert.equal(summary.overdueTotal, 11000);
  assert.equal(summary.nextPayment.number, 2);
  assert.match(summary.whatsappText, /Resumen de Perfumes/);
  assert.match(summary.whatsappText, /360 Red for Women/);
  assert.match(summary.whatsappText, /En mora:/);
  assert.match(summary.whatsappText, /Proximo|Pr/);
});

test("buildSalePaymentSummary omits overdue text when there is no overdue balance", async () => {
  const models = {
    sales: {
      findById: () => ({
        lean: async () => ({
          _id: "sale-2",
          name: "Cliente al dia",
          total: 30000,
          total_paid: 10000,
          balance_due: 20000,
        }),
      }),
    },
    sale_item: {
      find: () => ({
        lean: async () => [
          { _id: "item-1", product: "product-1", quantity: 1, total: 30000, discount: 0 },
        ],
      }),
    },
    product: {
      find: () => ({
        select: () => ({
          lean: async () => [{ _id: "product-1", name: "Perfume demo" }],
        }),
      }),
    },
    payment_plan: {
      find: () => ({
        sort: () => ({
          lean: async () => [
            {
              _id: "plan-1",
              installment_number: 1,
              due_date: "2999-04-30",
              planned_amount: 20000,
              paid_amount: 0,
            },
          ],
        }),
      }),
    },
  };

  const service = loadWithMocks("src/services/salePaymentSummaryService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
  });

  const summary = await service.buildSalePaymentSummary("sale-2");

  assert.equal(summary.overdueTotal, 0);
  assert.doesNotMatch(summary.whatsappText, /En mora:/);
  assert.match(summary.whatsappText, /Proximo|Pr/);
});

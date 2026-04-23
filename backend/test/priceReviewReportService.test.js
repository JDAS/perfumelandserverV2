const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("executePriceReviewReport returns only active price alerts by default", async () => {
  const ProductModel = {
    find: () => ({
      sort: () => ({
        lean: async () => [
          {
            _id: "product-1",
            name: "Producto riesgo",
            brand: "Marca",
            price: 18000,
            supplier_last_wholesale_price: 15000,
            suggested_min_cash_price: 20000,
            cash_price_risk_alert: true,
            supplier_change_alert: false,
            supplier_is_offer: false,
            supplier_last_sync_at: "2026-04-23",
          },
          {
            _id: "product-2",
            name: "Producto sano",
            price: 30000,
            supplier_last_wholesale_price: 15000,
            suggested_min_cash_price: 20000,
            cash_price_risk_alert: false,
            supplier_change_alert: false,
            supplier_is_offer: false,
          },
        ],
      }),
    }),
  };

  const service = loadWithMocks("src/services/priceReviewReportService.js", {
    "../models/CustomObject": {
      findOne: () => ({
        lean: async () => ({ apiName: "product", name: "Producto" }),
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: () => ProductModel,
    },
  });

  const result = await service.executePriceReviewReport({
    _id: "report-1",
    name: "Revision de precios",
    apiName: "price_review",
    sourceObject: "product",
  });

  assert.equal(result.viewType, "price_review");
  assert.equal(result.summary.products_count, 2);
  assert.equal(result.summary.cash_risk_count, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].name, "Producto riesgo");
  assert.equal(result.rows[0].review_reason, "Riesgo contado");
});

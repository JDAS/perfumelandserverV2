const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("sale stock validation blocks quantities above availability", async () => {
  const service = loadWithMocks("src/services/saleStockValidationService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: () => ({
        findById: () => ({ lean: async () => ({ _id: "product-1", name: "Perfume", available: 1 }) }),
      }),
    },
  });

  await assert.rejects(
    () => service.validateSaleItemStock({ record: { product: "product-1", quantity: 2 } }),
    (error) => error.code === "INSUFFICIENT_STOCK" && error.statusCode === 400
  );
});

test("sale stock validation allows an existing completed line to keep its own units", async () => {
  const service = loadWithMocks("src/services/saleStockValidationService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: () => ({
        findById: () => ({ lean: async () => ({ _id: "product-1", name: "Perfume", available: 0 }) }),
      }),
    },
  });

  await service.validateSaleItemStock({
    record: { product: "product-1", quantity: 1, sale_status: "Completada" },
    previousRecord: { product: "product-1", quantity: 1, sale_status: "Completada" },
  });
});

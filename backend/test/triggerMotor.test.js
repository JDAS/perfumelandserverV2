const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

const {
  applyTemplateValue,
  evaluateConditions,
  runTriggers,
} = require("../src/services/triggerMotor");

test("applyTemplateValue resolves current and previous record placeholders", () => {
  const result = applyTemplateValue(
    "Hola {{name}} antes {{previous.status}}",
    { name: "Ana" },
    { status: "nuevo" }
  );

  assert.equal(result, "Hola Ana antes nuevo");
});

test("evaluateConditions supports grouped OR conditions", () => {
  const result = evaluateConditions(
    {
      operator: "OR",
      conditions: [
        { field: "status", operator: "eq", value: "cerrado" },
        {
          operator: "AND",
          conditions: [
            { field: "total", operator: "gte", value: 1000 },
            { field: "active", operator: "eq", value: true },
          ],
        },
      ],
    },
    { status: "abierto", total: 1500, active: true }
  );

  assert.equal(result, true);
});

test("runTriggers executes active triggers in order and mutates record through actions", async () => {
  const logs = [];
  const logger = {
    log: (...args) => logs.push(args),
    error: (...args) => logs.push(["error", ...args]),
  };

  const objectDefinition = {
    automationTriggers: [
      {
        name: "Segundo",
        isActive: true,
        when: "beforeInsert",
        runOrder: 2,
        conditions: [{ field: "status", operator: "eq", value: "draft" }],
        actions: [
          {
            type: "updateField",
            config: { field: "message", value: "Estado {{status}}" },
          },
        ],
      },
      {
        name: "Primero",
        isActive: true,
        when: "beforeInsert",
        runOrder: 1,
        actions: [
          {
            type: "updateField",
            config: { field: "status", value: "draft" },
          },
          {
            type: "log",
            config: { message: "Trigger {{status}}" },
          },
        ],
      },
    ],
  };

  const result = await runTriggers({
    objectDefinition,
    when: "beforeInsert",
    objectApiName: "quote",
    record: { status: "new" },
    logger,
  });

  assert.equal(result.status, "draft");
  assert.equal(result.message, "Estado draft");
  assert.equal(logs[0][1].message, "Trigger draft");
});

test("syncSaleItemStatus recalculates parent rollups after syncing sale items", async () => {
  let updatedSaleItems = null;
  let productBulkOps = null;
  let rollupRequest = null;

  const SaleItemModel = {
    find: () => ({
      lean: async () => [{ _id: "item-1", product: "product-1", quantity: 1 }],
    }),
    updateMany: async (query, update) => {
      updatedSaleItems = { query, update };
    },
    aggregate: async () => [{ _id: "product-1", totalQuantity: 1 }],
  };

  const ProductModel = {
    bulkWrite: async (ops) => {
      productBulkOps = ops;
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) =>
        apiName === "sale_item" ? SaleItemModel : ProductModel,
    },
    "../models/CustomObject": {
      findOne: () => ({ lean: async () => null }),
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  await runTriggersWithMocks({
    objectDefinition: {
      automationTriggers: [
        {
          name: "Sincronizar estado de lineas",
          isActive: true,
          when: "afterUpdate",
          stopOnError: true,
          actions: [
            {
              type: "syncSaleItemStatus",
              config: {
                targetObject: "sale_item",
                productObject: "product",
              },
            },
          ],
        },
      ],
    },
    when: "afterUpdate",
    objectApiName: "sales",
    record: { _id: "sale-1", status: "Completada" },
    previousRecord: { _id: "sale-1", status: "Borrador" },
    recalculateRollupsForParent: async (request) => {
      rollupRequest = request;
    },
  });

  assert.deepEqual(updatedSaleItems, {
    query: { sale: "sale-1" },
    update: { $set: { sale_status: "Completada" } },
  });
  assert.equal(productBulkOps[0].updateOne.filter._id, "product-1");
  assert.deepEqual(rollupRequest, {
    parentObjectApiName: "sales",
    parentRecordId: "sale-1",
  });
});

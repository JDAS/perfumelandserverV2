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

test("syncSaleItemStatus safely skips sales without sale items", async () => {
  let updateCalled = false;
  let rollupCalled = false;

  const SaleItemModel = {
    find: () => ({
      lean: async () => [],
    }),
    updateMany: async () => {
      updateCalled = true;
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: () => SaleItemModel,
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  const result = await runTriggersWithMocks({
    objectDefinition: {
      automationTriggers: [
        {
          name: "Sincronizar estado de lineas",
          isActive: true,
          when: "afterUpdate",
          stopOnError: true,
          actions: [{ type: "syncSaleItemStatus", config: {} }],
        },
      ],
    },
    when: "afterUpdate",
    objectApiName: "sales",
    record: { _id: "sale-1", status: "Completada" },
    recalculateRollupsForParent: async () => {
      rollupCalled = true;
    },
  });

  assert.equal(result.status, "Completada");
  assert.equal(updateCalled, false);
  assert.equal(rollupCalled, false);
});

test("setSalePaymentStatus covers draft, canceled, pending, partial, and paid", async () => {
  const cases = [
    [{ status: "Borrador", total: 41000, total_paid: 0 }, "Borrador"],
    [{ status: "Cancelada", total: 41000, total_paid: 0 }, "Cancelada"],
    [{ status: "Completada", total: 41000, total_paid: 0 }, "Pendiente"],
    [{ status: "Completada", total: 41000, total_paid: 10000 }, "Parcial"],
    [{ status: "Completada", total: 41000, total_paid: 41000 }, "Pagada"],
  ];

  for (const [record, expected] of cases) {
    const result = await runTriggers({
      objectDefinition: {
        automationTriggers: [
          {
            name: "Actualizar estado de pago",
            isActive: true,
            when: "afterUpdate",
            stopOnError: true,
            actions: [{ type: "setSalePaymentStatus", config: {} }],
          },
        ],
      },
      when: "afterUpdate",
      objectApiName: "sales",
      record,
    });

    assert.equal(result.payment_status, expected);
  }
});

test("setSaleItemPrice applies credit surcharge and cost snapshot from latest stock", async () => {
  const records = {
    product: { _id: "product-1", price: 24000 },
    sales: { _id: "sale-1", type: "Credito" },
    stock: { _id: "stock-1", wholesaleprice: 12500 },
  };

  const makeFindById = (apiName) => () => ({
    lean: async () => records[apiName],
  });

  const models = {
    product: { findById: makeFindById("product") },
    sales: { findById: makeFindById("sales") },
    stock: {
      findOne: () => ({
        sort: () => ({
          lean: async () => records.stock,
        }),
      }),
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  const result = await runTriggersWithMocks({
    objectDefinition: {
      apiName: "sale_item",
      fields: [
        { apiName: "product", type: "lookup", referenceTo: "product" },
        { apiName: "sale", type: "lookup", referenceTo: "sales" },
      ],
      automationTriggers: [
        {
          name: "Tomar precio",
          isActive: true,
          when: "beforeInsert",
          stopOnError: true,
          actions: [{ type: "setSaleItemPrice", config: {} }],
        },
      ],
    },
    when: "beforeInsert",
    objectApiName: "sale_item",
    record: { product: "product-1", sale: "sale-1", quantity: 1 },
  });

  assert.equal(result.price, 27000);
  assert.equal(result.list_price, 27000);
  assert.equal(result.cost_snapshot, 12500);
});

test("setSaleItemPrice uses upper credit surcharge above threshold", async () => {
  const models = {
    product: {
      findById: () => ({
        lean: async () => ({ _id: "product-1", price: 26000 }),
      }),
    },
    sales: {
      findById: () => ({
        lean: async () => ({ _id: "sale-1", type: "Credito" }),
      }),
    },
    stock: {
      findOne: () => ({
        sort: () => ({
          lean: async () => null,
        }),
      }),
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  const result = await runTriggersWithMocks({
    objectDefinition: {
      fields: [
        { apiName: "product", type: "lookup", referenceTo: "product" },
        { apiName: "sale", type: "lookup", referenceTo: "sales" },
      ],
      automationTriggers: [
        {
          name: "Tomar precio",
          isActive: true,
          when: "beforeInsert",
          stopOnError: true,
          actions: [{ type: "setSaleItemPrice", config: {} }],
        },
      ],
    },
    when: "beforeInsert",
    objectApiName: "sale_item",
    record: { product: "product-1", sale: "sale-1" },
  });

  assert.equal(result.price, 31000);
  assert.equal(result.cost_snapshot, undefined);
});

test("setSaleItemPrice safely skips missing related records", async () => {
  const models = {
    product: {
      findById: () => ({
        lean: async () => null,
      }),
    },
    sales: {
      findById: () => ({
        lean: async () => ({ _id: "sale-1", type: "Credito" }),
      }),
    },
    stock: {
      findOne: () => ({
        sort: () => ({
          lean: async () => null,
        }),
      }),
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  const result = await runTriggersWithMocks({
    objectDefinition: {
      fields: [
        { apiName: "product", type: "lookup", referenceTo: "product" },
        { apiName: "sale", type: "lookup", referenceTo: "sales" },
      ],
      automationTriggers: [
        {
          name: "Tomar precio",
          isActive: true,
          when: "beforeInsert",
          stopOnError: true,
          actions: [{ type: "setSaleItemPrice", config: {} }],
        },
      ],
    },
    when: "beforeInsert",
    objectApiName: "sale_item",
    record: { product: "missing-product", sale: "sale-1", price: 0 },
  });

  assert.equal(result.price, 0);
});

test("generatePaymentPlan creates installments, applies payments, and links touched plan", async () => {
  const deletedPlans = [];
  const createdPlans = [];
  const paymentBulkOps = [];

  const PaymentPlanModel = {
    find: () => ({
      lean: async () => [{ version: 2 }],
    }),
    deleteMany: async (query) => {
      deletedPlans.push(query);
    },
    create: async (drafts) => {
      createdPlans.push(...drafts);
      return drafts.map((draft, index) => ({ ...draft, _id: `plan-${index + 1}` }));
    },
  };

  const PaymentModel = {
    find: () => ({
      sort: () => ({
        lean: async () => [{ _id: "payment-1", amount: 30000, date: "2999-04-03" }],
      }),
    }),
    bulkWrite: async (ops) => {
      paymentBulkOps.push(...ops);
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) =>
        apiName === "payment_plan" ? PaymentPlanModel : PaymentModel,
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  await runTriggersWithMocks({
    objectDefinition: {
      automationTriggers: [
        {
          name: "Generar plan",
          isActive: true,
          when: "afterUpdate",
          stopOnError: true,
          actions: [{ type: "generatePaymentPlan", config: {} }],
        },
      ],
    },
    when: "afterUpdate",
    objectApiName: "sales",
    record: {
      _id: "sale-1",
      total: 62000,
      type: "Credito",
      credittype: "Normal",
      quotes: 4,
      saledate: "2999-04-01",
    },
  });

  assert.deepEqual(deletedPlans, [{ sale_id: "sale-1" }]);
  assert.equal(createdPlans.length, 4);
  assert.deepEqual(
    createdPlans.map((plan) => [plan.installment_number, plan.planned_amount, plan.paid_amount, plan.status]),
    [
      [1, 26000, 26000, "Paid"],
      [2, 12000, 4000, "Partial"],
      [3, 12000, 0, "Pending"],
      [4, 12000, 0, "Pending"],
    ]
  );
  assert.equal(createdPlans[0].version, 3);
  assert.deepEqual(paymentBulkOps, [
    {
      updateOne: {
        filter: { _id: "payment-1" },
        update: { $set: { payment_plan_id: "plan-1" } },
      },
    },
  ]);
});

test("generatePaymentPlan clears generated plans when sale is not payable", async () => {
  const deletedPlans = [];
  const detachedPayments = [];

  const PaymentPlanModel = {
    deleteMany: async (query) => {
      deletedPlans.push(query);
    },
  };

  const PaymentModel = {
    updateMany: async (query, update) => {
      detachedPayments.push({ query, update });
    },
  };

  const { runTriggers: runTriggersWithMocks } = loadWithMocks("src/services/triggerMotor.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) =>
        apiName === "payment_plan" ? PaymentPlanModel : PaymentModel,
    },
    "./automationFlowService": {
      listExecutableFlows: async () => [],
    },
  });

  await runTriggersWithMocks({
    objectDefinition: {
      automationTriggers: [
        {
          name: "Generar plan",
          isActive: true,
          when: "afterUpdate",
          stopOnError: true,
          actions: [{ type: "generatePaymentPlan", config: {} }],
        },
      ],
    },
    when: "afterUpdate",
    objectApiName: "sales",
    record: {
      _id: "sale-1",
      total: 0,
      type: "Credito",
      credittype: "Normal",
      quotes: 1,
      saledate: "2999-04-01",
    },
  });

  assert.deepEqual(deletedPlans, [{ sale_id: "sale-1" }]);
  assert.deepEqual(detachedPayments, [
    {
      query: { sale_id: "sale-1" },
      update: { $unset: { payment_plan_id: 1 } },
    },
  ]);
});

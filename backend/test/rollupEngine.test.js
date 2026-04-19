const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("recalculateRollupsForParent persists derived formula fields after rollup changes", async () => {
  const triggerCalls = [];
  const childRows = [{ quantity: 1 }];
  const savedStates = [];

  const parentDoc = {
    _id: "product-1",
    purchaseditems: 2,
    sold: 0,
    available: 2,
    toObject() {
      return {
        _id: this._id,
        purchaseditems: this.purchaseditems,
        sold: this.sold,
        available: this.available,
      };
    },
    set(data) {
      Object.assign(this, data);
    },
    markModified() {},
    async save() {
      savedStates.push({
        purchaseditems: this.purchaseditems,
        sold: this.sold,
        available: this.available,
      });
      return this;
    },
  };

  const service = loadWithMocks("src/utils/rollupEngine.js", {
    "../models/CustomObject": {
      findOne: async () => ({
        apiName: "product",
        fields: [
          {
            apiName: "sold",
            type: "rollup",
            rollup: {
              relatedObject: "sale_item",
              relatedField: "product",
              operation: "sum",
              fieldToAggregate: "quantity",
            },
          },
          {
            apiName: "available",
            type: "formula",
            formula: { expression: "purchaseditems - sold", returnType: "number" },
          },
        ],
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: (name) => {
        if (name === "product") {
          return {
            findById: async () => parentDoc,
          };
        }

        if (name === "sale_item") {
          return {
            find: () => ({
              lean: async () => childRows,
            }),
          };
        }

        throw new Error(`Unexpected model ${name}`);
      },
    },
    "../services/formulaEngine": {
      applyFormulaFields: (_fields, record) => ({
        ...record,
        available: Number(record.purchaseditems || 0) - Number(record.sold || 0),
      }),
    },
    "../services/triggerMotor": {
      runTriggers: async (payload) => {
        triggerCalls.push(payload);
      },
    },
  });

  await service.recalculateRollupsForParent({
    parentObjectApiName: "product",
    parentRecordId: "product-1",
  });

  assert.deepEqual(savedStates, [
    {
      purchaseditems: 2,
      sold: 1,
      available: 1,
    },
  ]);
  assert.equal(triggerCalls.length, 1);
  assert.equal(triggerCalls[0].record.sold, 1);
  assert.equal(triggerCalls[0].record.available, 1);
});

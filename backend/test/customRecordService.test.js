const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("saveRecord creates a record, runs triggers, and returns blocked fields", async () => {
  const triggerCalls = [];
  const rollupCalls = [];
  const inventoryCalls = [];

  const createdRecords = [];

  const fakeRecordModel = {
    create: async (payload) => {
      createdRecords.push(payload);
      return {
        ...payload,
        _id: "new-record",
        toObject() {
          return { ...this };
        },
      };
    },
  };

  const service = loadWithMocks("src/services/customRecordService.js", {
    "../models/CustomObject": {
      findOne: () => ({
        lean: async () => ({
          apiName: "quote",
          fields: [{ apiName: "name", type: "text" }],
          listViews: [],
          automationTriggers: [],
        }),
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: () => fakeRecordModel,
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => ({ ...record, formulaApplied: true }),
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async (payload) => {
        rollupCalls.push(payload);
      },
    },
    "./recordValidationService": {
      buildDefaultPayload: () => ({ defaulted: "yes" }),
      validateRecordPayload: async () => ({
        sanitizedPayload: { name: "Base" },
        errors: [],
        invalidFields: [],
        blockedFields: ["createdAt"],
      }),
    },
    "./triggerMotor": {
      runTriggers: async (payload) => {
        triggerCalls.push(payload.when);
        return {
          ...payload.record,
          ...(payload.when === "beforeInsert" ? { beforeRan: true } : {}),
        };
      },
    },
    "./inventorySyncService": {
      syncInventoryForProducts: async (payload) => {
        inventoryCalls.push(payload);
      },
    },
    "./customRecordQueryService": {
      resolveLookupData: async (records) => records,
      listRecords: async () => {
        throw new Error("not used");
      },
      getRecordByIdEnriched: async () => {
        throw new Error("not used");
      },
      getRelatedRecords: async () => {
        throw new Error("not used");
      },
    },
  });

  const result = await service.saveRecord({
    objectApiName: "quote",
    payload: { name: "Input" },
    user: { _id: "user-1" },
  });

  assert.deepEqual(triggerCalls, ["beforeInsert", "afterInsert"]);
  assert.equal(createdRecords[0].createdBy, "user-1");
  assert.equal(createdRecords[0].updatedBy, "user-1");
  assert.equal(createdRecords[0].beforeRan, true);
  assert.equal(createdRecords[0].formulaApplied, true);
  assert.deepEqual(result.blockedFields, ["createdAt"]);
  assert.equal(rollupCalls.length, 1);
  assert.equal(inventoryCalls.length, 0);
});

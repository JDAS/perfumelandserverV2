const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("saveRecord creates a record, runs triggers, and returns blocked fields", async () => {
  const triggerCalls = [];
  const rollupCalls = [];
  const inventoryCalls = [];
  const campaignCalls = [];

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
    "./campaignSyncService": {
      syncSaleCampaigns: async (payload) => {
        campaignCalls.push(payload);
      },
    },
    "./campaignSyncHooks": {
      shouldSyncCampaignsForSale: () => false,
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
  assert.equal(campaignCalls.length, 0);
});

test("saveRecord syncs campaigns automatically for sales when sensitive fields change", async () => {
  const campaignCalls = [];

  const existingRecord = {
    _id: "sale-1",
    status: "Borrador",
    total: 12000,
    saledate: "2026-04-20",
    client_id: "client-1",
    name: "Venta demo",
    set(payload) {
      Object.assign(this, payload);
    },
    markModified() {},
    async save() {
      return {
        ...this,
        toObject() {
          return { ...this };
        },
      };
    },
    toObject() {
      return { ...this };
    },
  };

  const service = loadWithMocks("src/services/customRecordService.js", {
    "../models/CustomObject": {
      findOne: () => ({
        lean: async () => ({
          apiName: "sales",
          fields: [{ apiName: "status", type: "text" }],
          listViews: [],
          automationTriggers: [],
        }),
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: () => ({
        findById: async () => existingRecord,
      }),
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => record,
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./recordValidationService": {
      buildDefaultPayload: () => ({}),
      validateRecordPayload: async () => ({
        sanitizedPayload: { status: "Completada" },
        errors: [],
        invalidFields: [],
        blockedFields: [],
      }),
    },
    "./triggerMotor": {
      runTriggers: async (payload) => payload.record,
    },
    "./inventorySyncService": {
      syncInventoryForProducts: async () => {},
    },
    "./campaignSyncService": {
      syncSaleCampaigns: async (payload) => {
        campaignCalls.push(payload);
      },
    },
    "./campaignSyncHooks": {
      shouldSyncCampaignsForSale: () => true,
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

  await service.saveRecord({
    objectApiName: "sales",
    recordId: "sale-1",
    payload: { status: "Completada" },
    user: { _id: "user-2" },
  });

  assert.deepEqual(campaignCalls, [{ saleId: "sale-1", user: { _id: "user-2" } }]);
});

test("deleteRecord cascades children when required lookup points to parent", async () => {
  const deleted = [];
  const objectDefinitions = {
    sales: {
      apiName: "sales",
      fields: [{ apiName: "name", type: "text" }],
      automationTriggers: [],
    },
    sale_item: {
      apiName: "sale_item",
      fields: [
        {
          apiName: "sale",
          label: "Venta",
          type: "lookup",
          referenceTo: "sales",
          required: true,
        },
      ],
      automationTriggers: [],
    },
  };

  const makeRecord = (_id, extra = {}) => ({
    _id,
    ...extra,
    toObject() {
      return { _id, ...extra };
    },
  });

  const models = {
    sales: {
      findById: async () => makeRecord("sale-1"),
      findByIdAndDelete: async (id) => {
        deleted.push(`sales:${id}`);
      },
    },
    sale_item: {
      findById: async (id) => makeRecord(id, { sale: "sale-1", product: "product-1" }),
      findByIdAndDelete: async (id) => {
        deleted.push(`sale_item:${id}`);
      },
      countDocuments: async () => 2,
      find: () => ({
        select: () => ({
          lean: async () => [{ _id: "item-1" }, { _id: "item-2" }],
        }),
      }),
    },
  };

  const service = loadWithMocks("src/services/customRecordService.js", {
    "../models/CustomObject": {
      findOne: ({ apiName }) => ({
        lean: async () => objectDefinitions[apiName],
      }),
      find: (query) => ({
        lean: async () => {
          const referenceTo = query.fields.$elemMatch.referenceTo;
          return Object.values(objectDefinitions).filter((definition) =>
            (definition.fields || []).some(
              (field) => field.type === "lookup" && field.referenceTo === referenceTo
            )
          );
        },
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => models[apiName],
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => record,
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./recordValidationService": {
      buildDefaultPayload: () => ({}),
      validateRecordPayload: async () => ({
        sanitizedPayload: {},
        errors: [],
        invalidFields: [],
        blockedFields: [],
      }),
    },
    "./triggerMotor": {
      runTriggers: async (payload) => payload.record,
    },
    "./inventorySyncService": {
      syncInventoryForProducts: async () => {},
    },
    "./campaignSyncService": {
      syncSaleCampaigns: async () => {},
    },
    "./campaignSyncHooks": {
      shouldSyncCampaignsForSale: () => false,
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

  await service.deleteRecordWithTriggers({
    objectApiName: "sales",
    recordId: "sale-1",
  });

  assert.deepEqual(deleted, ["sale_item:item-1", "sale_item:item-2", "sales:sale-1"]);
});

test("deleteRecord detaches optional lookup children by default", async () => {
  const updates = [];
  const deleted = [];
  const objectDefinitions = {
    client: {
      apiName: "client",
      fields: [{ apiName: "name", type: "text" }],
      automationTriggers: [],
    },
    sales: {
      apiName: "sales",
      fields: [
        {
          apiName: "client_id",
          label: "Cliente",
          type: "lookup",
          referenceTo: "client",
          required: false,
        },
      ],
      automationTriggers: [],
    },
  };

  const service = loadWithMocks("src/services/customRecordService.js", {
    "../models/CustomObject": {
      findOne: ({ apiName }) => ({
        lean: async () => objectDefinitions[apiName],
      }),
      find: (query) => ({
        lean: async () => {
          const referenceTo = query.fields.$elemMatch.referenceTo;
          return Object.values(objectDefinitions).filter((definition) =>
            (definition.fields || []).some(
              (field) => field.type === "lookup" && field.referenceTo === referenceTo
            )
          );
        },
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) =>
        apiName === "client"
          ? {
              findById: async () => ({
                _id: "client-1",
                toObject() {
                  return { _id: "client-1" };
                },
              }),
              findByIdAndDelete: async (id) => {
                deleted.push(`client:${id}`);
              },
            }
          : {
              countDocuments: async () => 3,
              updateMany: async (query, update) => {
                updates.push({ query, update });
              },
            },
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => record,
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./recordValidationService": {
      buildDefaultPayload: () => ({}),
      validateRecordPayload: async () => ({
        sanitizedPayload: {},
        errors: [],
        invalidFields: [],
        blockedFields: [],
      }),
    },
    "./triggerMotor": {
      runTriggers: async (payload) => payload.record,
    },
    "./inventorySyncService": {
      syncInventoryForProducts: async () => {},
    },
    "./campaignSyncService": {
      syncSaleCampaigns: async () => {},
    },
    "./campaignSyncHooks": {
      shouldSyncCampaignsForSale: () => false,
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

  await service.deleteRecordWithTriggers({
    objectApiName: "client",
    recordId: "client-1",
  });

  assert.deepEqual(updates, [
    {
      query: { client_id: "client-1" },
      update: { $unset: { client_id: "" } },
    },
  ]);
  assert.deepEqual(deleted, ["client:client-1"]);
});

test("deleteRecord restricts deletion when lookup policy is restrict", async () => {
  const objectDefinitions = {
    client: {
      apiName: "client",
      fields: [{ apiName: "name", type: "text" }],
      automationTriggers: [],
    },
    sales: {
      apiName: "sales",
      fields: [
        {
          apiName: "client_id",
          label: "Cliente",
          type: "lookup",
          referenceTo: "client",
          required: false,
          onParentDelete: "restrict",
        },
      ],
      automationTriggers: [],
    },
  };

  const service = loadWithMocks("src/services/customRecordService.js", {
    "../models/CustomObject": {
      findOne: ({ apiName }) => ({
        lean: async () => objectDefinitions[apiName],
      }),
      find: (query) => ({
        lean: async () => {
          const referenceTo = query.fields.$elemMatch.referenceTo;
          return Object.values(objectDefinitions).filter((definition) =>
            (definition.fields || []).some(
              (field) => field.type === "lookup" && field.referenceTo === referenceTo
            )
          );
        },
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) =>
        apiName === "client"
          ? {
              findById: async () => ({
                _id: "client-1",
                toObject() {
                  return { _id: "client-1" };
                },
              }),
              findByIdAndDelete: async () => {
                throw new Error("should not delete parent");
              },
            }
          : {
              countDocuments: async () => 1,
            },
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => record,
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./recordValidationService": {
      buildDefaultPayload: () => ({}),
      validateRecordPayload: async () => ({
        sanitizedPayload: {},
        errors: [],
        invalidFields: [],
        blockedFields: [],
      }),
    },
    "./triggerMotor": {
      runTriggers: async (payload) => payload.record,
    },
    "./inventorySyncService": {
      syncInventoryForProducts: async () => {},
    },
    "./campaignSyncService": {
      syncSaleCampaigns: async () => {},
    },
    "./campaignSyncHooks": {
      shouldSyncCampaignsForSale: () => false,
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

  await assert.rejects(
    () =>
      service.deleteRecordWithTriggers({
        objectApiName: "client",
        recordId: "client-1",
      }),
    (error) => error.statusCode === 409 && /registros relacionados/.test(error.message)
  );
});

test("deleteRecord ignores children when lookup policy is ignore", async () => {
  const updates = [];
  const deleted = [];
  const objectDefinitions = {
    client: {
      apiName: "client",
      fields: [{ apiName: "name", type: "text" }],
      automationTriggers: [],
    },
    sales: {
      apiName: "sales",
      fields: [
        {
          apiName: "client_id",
          label: "Cliente",
          type: "lookup",
          referenceTo: "client",
          required: false,
          onParentDelete: "ignore",
        },
      ],
      automationTriggers: [],
    },
  };

  const service = loadWithMocks("src/services/customRecordService.js", {
    "../models/CustomObject": {
      findOne: ({ apiName }) => ({
        lean: async () => objectDefinitions[apiName],
      }),
      find: (query) => ({
        lean: async () => {
          const referenceTo = query.fields.$elemMatch.referenceTo;
          return Object.values(objectDefinitions).filter((definition) =>
            (definition.fields || []).some(
              (field) => field.type === "lookup" && field.referenceTo === referenceTo
            )
          );
        },
      }),
    },
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) =>
        apiName === "client"
          ? {
              findById: async () => ({
                _id: "client-1",
                toObject() {
                  return { _id: "client-1" };
                },
              }),
              findByIdAndDelete: async (id) => {
                deleted.push(`client:${id}`);
              },
            }
          : {
              countDocuments: async () => 1,
              updateMany: async (query, update) => {
                updates.push({ query, update });
              },
            },
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => record,
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./recordValidationService": {
      buildDefaultPayload: () => ({}),
      validateRecordPayload: async () => ({
        sanitizedPayload: {},
        errors: [],
        invalidFields: [],
        blockedFields: [],
      }),
    },
    "./triggerMotor": {
      runTriggers: async (payload) => payload.record,
    },
    "./inventorySyncService": {
      syncInventoryForProducts: async () => {},
    },
    "./campaignSyncService": {
      syncSaleCampaigns: async () => {},
    },
    "./campaignSyncHooks": {
      shouldSyncCampaignsForSale: () => false,
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

  await service.deleteRecordWithTriggers({
    objectApiName: "client",
    recordId: "client-1",
  });

  assert.deepEqual(updates, []);
  assert.deepEqual(deleted, ["client:client-1"]);
});

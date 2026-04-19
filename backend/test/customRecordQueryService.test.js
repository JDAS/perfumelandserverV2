const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("resolveLookupData enriches lookup fields with label and record", async () => {
  const models = {
    customer: {
      find: () => ({
        lean: async () => [{ _id: "c1", name: "Cliente Uno" }],
      }),
    },
  };

  const service = loadWithMocks("src/services/customRecordQueryService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (name) => models[name],
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => record,
    },
  });

  const records = await service.resolveLookupData(
    [{ _id: "r1", customer: "c1" }],
    {
      fields: [{ apiName: "customer", type: "lookup", referenceTo: "customer" }],
    }
  );

  assert.equal(records[0]._lookup.customer.label, "Cliente Uno");
  assert.equal(records[0]._lookup.customer.record._id, "c1");
});

test("listRecords builds pagination and applies formula enrichment", async () => {
  let receivedQuery = null;
  let receivedSort = null;

  const recordModel = {
    find(query) {
      receivedQuery = query;
      return {
        sort(sortSpec) {
          receivedSort = sortSpec;
          return this;
        },
        skip() {
          return this;
        },
        limit() {
          return this;
        },
        lean: async () => [{ _id: "r1", name: "Perfume" }],
      };
    },
    countDocuments: async () => 1,
  };

  const service = loadWithMocks("src/services/customRecordQueryService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: () => recordModel,
    },
    "../utils/formulaEngine": {
      applyFormulaFields: (_fields, record) => ({
        ...record,
        computed: "ok",
      }),
    },
  });

  const result = await service.listRecords({
    objectDefinition: {
      apiName: "product",
      fields: [{ apiName: "name", type: "text" }],
      listViews: [{ apiName: "all", isDefault: true, filters: [], sortBy: "name", sortOrder: "asc" }],
    },
    params: {
      search: "Per",
      page: 1,
      limit: 10,
    },
  });

  assert.deepEqual(receivedQuery.$or, [
    { name: { $regex: "Per", $options: "i" } },
  ]);
  assert.deepEqual(receivedSort, { name: 1, _id: -1 });
  assert.equal(result.records[0].computed, "ok");
  assert.equal(result.pagination.total, 1);
});

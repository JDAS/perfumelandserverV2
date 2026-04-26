const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("createFlow persists a valid normalized automation flow", async () => {
  const createdPayloads = [];

  const service = loadWithMocks("src/services/automationFlowService.js", {
    mongoose: {
      connection: { readyState: 1 },
    },
    "../models/AutomationFlow": {
      findOne: () => ({
        lean: async () => null,
      }),
      create: async (payload) => {
        createdPayloads.push(payload);
        return { ...payload, _id: "flow-1" };
      },
      find: () => ({
        sort: () => ({
          lean: async () => [],
        }),
      }),
    },
    "../models/CustomObject": {
      findOne: ({ apiName }) => ({
        lean: async () => {
          if (apiName === "sales") {
            return {
              apiName: "sales",
              fields: [
                { apiName: "status", type: "text" },
                { apiName: "review_needed", type: "boolean" },
              ],
            };
          }

          if (apiName === "task") {
            return {
              apiName: "task",
              fields: [{ apiName: "title", type: "text" }],
            };
          }

          return null;
        },
      }),
    },
  });

  const result = await service.createFlow({
    name: "Seguimiento venta completada",
    objectApiName: "sales",
    when: "afterUpdate",
    actions: [
      {
        type: "setBoolean",
        config: { field: "review_needed", value: true },
      },
      {
        type: "createRecord",
        config: { object: "task", values: { title: "Revisar venta" } },
      },
    ],
  });

  assert.equal(result._id, "flow-1");
  assert.equal(createdPayloads[0].apiName, "seguimiento_venta_completada");
  assert.equal(createdPayloads[0].objectApiName, "sales");
});

test("updateFlow rejects invalid destination fields", async () => {
  const service = loadWithMocks("src/services/automationFlowService.js", {
    mongoose: {
      connection: { readyState: 1 },
    },
    "../models/AutomationFlow": {
      findById: async () => ({
        _id: "flow-2",
        toObject() {
          return {
            _id: "flow-2",
            name: "Flow base",
            apiName: "flow_base",
            objectApiName: "sales",
            when: "afterUpdate",
            actions: [],
          };
        },
        set() {},
        async save() {
          return this;
        },
      }),
      findOne: () => ({
        lean: async () => null,
      }),
      find: () => ({
        sort: () => ({
          lean: async () => [],
        }),
      }),
    },
    "../models/CustomObject": {
      findOne: ({ apiName }) => ({
        lean: async () => {
          if (apiName === "sales") {
            return {
              apiName: "sales",
              fields: [{ apiName: "status", type: "text" }],
            };
          }

          return null;
        },
      }),
    },
  });

  await assert.rejects(
    () =>
      service.updateFlow("flow-2", {
        actions: [
          {
            type: "setBoolean",
            config: {
              field: "review_needed",
              value: true,
            },
          },
        ],
      }),
    /campo destino no existe/i
  );
});

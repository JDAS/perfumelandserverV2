const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("validateFlowDefinition accepts a supported flow definition", async () => {
  const service = loadWithMocks("src/services/automationFlowService.js", {
    mongoose: {
      connection: { readyState: 1 },
    },
    "../models/AutomationFlow": {
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
                { apiName: "needs_review", type: "boolean" },
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

  const result = await service.validateFlowDefinition({
    name: "Seguimiento venta",
    objectApiName: "sales",
    when: "afterUpdate",
    conditions: {
      operator: "AND",
      conditions: [{ field: "status", operator: "equals", value: "Completada" }],
    },
    actions: [
      {
        type: "setBoolean",
        config: {
          field: "needs_review",
          value: true,
        },
      },
      {
        type: "createRecord",
        config: {
          object: "task",
          values: {
            title: "Revisar venta completada",
          },
        },
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("listExecutableFlows adapts active flows into trigger-compatible definitions", async () => {
  const service = loadWithMocks("src/services/automationFlowService.js", {
    mongoose: {
      connection: { readyState: 1 },
    },
    "../models/AutomationFlow": {
      find: () => ({
        sort: () => ({
          lean: async () => [
            {
              name: "Marcar riesgo",
              isActive: true,
              when: "afterUpdate",
              runOrder: 3,
              stopOnError: true,
              conditions: {
                operator: "AND",
                conditions: [
                  {
                    field: "cash_price_risk_alert",
                    operator: "equals",
                    value: true,
                  },
                ],
              },
              actions: [
                {
                  type: "setStatus",
                  config: {
                    value: "Pendiente revision",
                  },
                },
              ],
            },
          ],
        }),
      }),
    },
    "../models/CustomObject": {
      findOne: () => ({
        lean: async () => null,
      }),
    },
  });

  const flows = await service.listExecutableFlows({
    objectApiName: "product",
    when: "afterUpdate",
  });

  assert.equal(flows.length, 1);
  assert.equal(flows[0].conditions.conditions[0].operator, "eq");
  assert.deepEqual(flows[0].actions[0], {
    type: "updateField",
    config: {
      field: "status",
      value: "Pendiente revision",
    },
  });
});

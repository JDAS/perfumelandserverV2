const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("runTriggers executes active automation flows together with object triggers", async () => {
  const { runTriggers } = loadWithMocks("src/services/triggerMotor.js", {
    "./automationFlowService": {
      listExecutableFlows: async () => [
        {
          name: "Flow prueba",
          isActive: true,
          when: "afterUpdate",
          runOrder: 2,
          stopOnError: true,
          conditions: {
            operator: "AND",
            conditions: [
              { field: "status", operator: "eq", value: "Completada" },
            ],
          },
          actions: [
            {
              type: "updateField",
              config: {
                field: "flowApplied",
                value: true,
              },
            },
          ],
        },
      ],
    },
  });

  const result = await runTriggers({
    objectDefinition: {
      automationTriggers: [
        {
          name: "Trigger base",
          isActive: true,
          when: "afterUpdate",
          runOrder: 1,
          conditions: [],
          actions: [
            {
              type: "updateField",
              config: {
                field: "status",
                value: "Completada",
              },
            },
          ],
        },
      ],
    },
    when: "afterUpdate",
    objectApiName: "sales",
    record: { status: "Borrador" },
  });

  assert.equal(result.status, "Completada");
  assert.equal(result.flowApplied, true);
});

const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

const service = loadWithMocks("src/services/campaignSyncService.js", {
  "../models/CustomRecord": { getCustomRecordModel: () => ({}) },
  "../utils/rollupEngine": { recalculateRollupsForParent: async () => {} },
});

test("campaign sync assigns every available entry without failing on shortage", () => {
  const result = service.resolveEntryAssignment({
    missingCount: 5,
    availableNumbers: ["01", "02"],
  });

  assert.equal(result.requestedCount, 5);
  assert.equal(result.assignableCount, 2);
  assert.equal(result.unassignedCount, 3);
  assert.equal(result.selectedNumbers.length, 2);
  assert.deepEqual([...result.selectedNumbers].sort(), ["01", "02"]);
});

test("campaign sync reports no shortage when enough entries remain", () => {
  const result = service.resolveEntryAssignment({
    missingCount: 2,
    availableNumbers: ["01", "02", "03"],
  });

  assert.equal(result.assignableCount, 2);
  assert.equal(result.unassignedCount, 0);
  assert.equal(result.selectedNumbers.length, 2);
});

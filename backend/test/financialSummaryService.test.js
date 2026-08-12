const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

const { calculateFinancialPosition } = loadWithMocks(
  "src/services/financialSummaryService.js",
  {
    mongoose: {},
    "./inventoryReconciliationReportService": { buildInventoryReconciliationRows: () => [] },
  }
);

test("financial summary counts sold and unsold inventory once", () => {
  const result = calculateFinancialPosition({
    soldPerfumeCost: 6786700,
    unsoldInventoryCost: 310486,
    paidCommissions: 1108000,
    expenses: 146000,
    paidBonuses: 150000,
    totalReceived: 9057500,
    outstandingLoans: 9500,
  });

  assert.equal(result.totalPayments, 8501186);
  assert.equal(result.currentBudget, 546814);
});

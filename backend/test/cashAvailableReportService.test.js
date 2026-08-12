const assert = require("assert");
const { test } = require("./helpers/testHarness");
const { calculateCashAvailable } = require("../src/services/cashAvailableReportService");

test("cash available separates real inflows from cash outflows", () => {
  const result = calculateCashAvailable({
    collectedSales: 62000,
    contributions: 5000,
    incomingAdjustments: 1000,
    inventoryPurchases: 35000,
    paidCommissions: 5000,
    paidExpenses: 3000,
    paidBonuses: 2000,
    withdrawals: 10000,
    outgoingAdjustments: 1000,
  });
  assert.deepEqual(result, { inflows: 68000, outflows: 56000, available: 12000 });
});

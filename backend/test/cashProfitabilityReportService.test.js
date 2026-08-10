const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

const { calculateCashAndProfitability } = loadWithMocks(
  "src/services/cashProfitabilityReportService.js",
  { mongoose: {} }
);

test("cash profitability separates cash from cost of goods sold", () => {
  const result = calculateCashAndProfitability({
    initialBudget: 130000,
    totalReceived: 8887500,
    inventoryPurchases: 1647500,
    paidCommissions: 1078000,
    expenses: 146000,
    paidBonuses: 150000,
    outstandingLoans: 0,
    salesTotal: 9448000,
    accountsReceivable: 618500,
    revenueWithKnownCost: 9448000,
    costOfGoodsSold: 6643050,
    generatedCommissions: 1078000,
  });

  assert.equal(result.availableCash, 5996000);
  assert.equal(result.grossProfit, 2804950);
  assert.equal(result.expectedProfit, 1430950);
  assert.equal(result.accountsReceivable, 618500);
});

test("cash profitability does not treat a credit sale as collected cash", () => {
  const before = calculateCashAndProfitability({
    initialBudget: 100000,
    totalReceived: 50000,
    inventoryPurchases: 20000,
  });
  const afterCreditSale = calculateCashAndProfitability({
    initialBudget: 100000,
    totalReceived: 50000,
    inventoryPurchases: 20000,
    salesTotal: 30000,
    accountsReceivable: 30000,
    revenueWithKnownCost: 30000,
    costOfGoodsSold: 18000,
  });

  assert.equal(afterCreditSale.availableCash, before.availableCash);
  assert.equal(afterCreditSale.grossProfit, 12000);
  assert.equal(afterCreditSale.accountsReceivable, 30000);
});

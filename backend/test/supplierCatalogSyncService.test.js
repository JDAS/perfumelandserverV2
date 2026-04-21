const assert = require("assert");
const { test } = require("./helpers/testHarness");
const {
  buildPricingSignals,
  buildSupplierReferencePayload,
} = require("../src/services/supplierCatalogSyncService");

test("buildPricingSignals marks cash risk and supplier change alert when thresholds are exceeded", () => {
  const signals = buildPricingSignals(
    {
      price: 18000,
      supplier_last_wholesale_price: 12000,
    },
    15000
  );

  assert.strictEqual(signals.supplier_previous_wholesale_price, 12000);
  assert.strictEqual(signals.supplier_wholesale_delta, 3000);
  assert.strictEqual(signals.supplier_wholesale_delta_pct, 25);
  assert.strictEqual(signals.supplier_change_alert, true);
  assert.strictEqual(signals.suggested_min_cash_price, 20000);
  assert.strictEqual(signals.cash_price_risk_alert, true);
});

test("buildPricingSignals stays calm when there is no previous supplier price and margin is healthy", () => {
  const signals = buildPricingSignals(
    {
      price: 26000,
      supplier_last_wholesale_price: null,
    },
    20000
  );

  assert.strictEqual(signals.supplier_previous_wholesale_price, null);
  assert.strictEqual(signals.supplier_wholesale_delta, 0);
  assert.strictEqual(signals.supplier_wholesale_delta_pct, 0);
  assert.strictEqual(signals.supplier_change_alert, false);
  assert.strictEqual(signals.suggested_min_cash_price, 25000);
  assert.strictEqual(signals.cash_price_risk_alert, false);
});

test("buildSupplierReferencePayload keeps supplier fields when there is a match", () => {
  const payload = buildSupplierReferencePayload(
    { name: "9PM", price: 16000, supplier_last_wholesale_price: 12000 },
    {
      matchType: "legacySheetName",
      entry: {
        supplier_name: "9 PM HOMBRE 100ML EDP AFNAN",
        supplier_price_value: 13000,
        supplier_price_raw: "13000 OFERTA",
        supplier_is_offer: true,
      },
    }
  );

  assert.strictEqual(payload.supplier_match_name, "9 PM HOMBRE 100ML EDP AFNAN");
  assert.strictEqual(payload.supplier_match_type, "legacySheetName");
  assert.strictEqual(payload.supplier_last_wholesale_price, 13000);
  assert.strictEqual(payload.supplier_price_raw, "13000 OFERTA");
  assert.strictEqual(payload.supplier_is_offer, true);
  assert.strictEqual(payload.supplier_previous_wholesale_price, 12000);
  assert.strictEqual(payload.supplier_wholesale_delta, 1000);
  assert.strictEqual(payload.supplier_wholesale_delta_pct, 8.33);
  assert.strictEqual(payload.supplier_change_alert, false);
  assert.strictEqual(payload.suggested_min_cash_price, 18000);
  assert.strictEqual(payload.cash_price_risk_alert, true);
});

test("buildSupplierReferencePayload clears supplier fields when there is no match", () => {
  const payload = buildSupplierReferencePayload(
    { name: "Sin match", supplier_last_wholesale_price: 15000 },
    { entry: null }
  );

  assert.strictEqual(payload.supplier_match_name, "");
  assert.strictEqual(payload.supplier_match_type, "Sin match");
  assert.strictEqual(payload.supplier_last_wholesale_price, null);
  assert.strictEqual(payload.supplier_price_raw, "");
  assert.strictEqual(payload.supplier_is_offer, false);
  assert.strictEqual(payload.supplier_previous_wholesale_price, 15000);
  assert.strictEqual(payload.supplier_change_alert, false);
  assert.strictEqual(payload.cash_price_risk_alert, false);
});

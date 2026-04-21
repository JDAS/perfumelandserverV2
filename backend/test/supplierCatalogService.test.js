const assert = require("assert");
const { test } = require("./helpers/testHarness");
const {
  parseSupplierPrice,
  parseSupplierCatalogCsv,
  buildSupplierCatalogIndex,
  matchSupplierEntryToProduct,
} = require("../src/services/supplierCatalogService");

test("parseSupplierPrice extracts numeric value and offer flag", () => {
  const parsed = parseSupplierPrice("25000 OFERTA");

  assert.strictEqual(parsed.value, 25000);
  assert.strictEqual(parsed.isOffer, true);
  assert.strictEqual(parsed.raw, "25000 OFERTA");
});

test("parseSupplierCatalogCsv skips noise and parses supplier entries", () => {
  const csv = [
    ",,,,,",
    "HACER PEDIDOS,,,,,",
    "PERFUMES,FOTO,PRECIO MAYORISTA",
    "360 BLACK HOMBRE 100ML,,,,24000 OFERTA",
    "CLOUD MUJER 100ML,,,,26000",
  ].join("\n");

  const entries = parseSupplierCatalogCsv(csv);

  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].supplier_name, "360 BLACK HOMBRE 100ML");
  assert.strictEqual(entries[0].supplier_price_value, 24000);
  assert.strictEqual(entries[0].supplier_is_offer, true);
  assert.strictEqual(entries[1].supplier_name, "CLOUD MUJER 100ML");
});

test("matchSupplierEntryToProduct prefers legacySheetName before aliases", () => {
  const entries = parseSupplierCatalogCsv(
    "360 BLACK HOMBRE 100ML,,,,24000 OFERTA\nAriana Grande Cloud,,,,26000"
  );
  const index = buildSupplierCatalogIndex(entries);

  const match = matchSupplierEntryToProduct(
    {
      name: "360° Black for Men",
      brand: "Perry Ellis",
      legacySheetName: "360 BLACK HOMBRE 100ML",
      aliases: "360 Black\n360 Black Hombre",
    },
    index
  );

  assert.ok(match.entry);
  assert.strictEqual(match.matchType, "legacySheetName");
  assert.strictEqual(match.entry.supplier_price_value, 24000);
});

test("matchSupplierEntryToProduct falls back to aliases when legacySheetName is missing", () => {
  const entries = parseSupplierCatalogCsv(
    "Cloud Mujer 100ML,,,,26000\nBright Crystal Mujer 90ML,,,,22000"
  );
  const index = buildSupplierCatalogIndex(entries);

  const match = matchSupplierEntryToProduct(
    {
      name: "Ariana Grande Cloud",
      brand: "Ariana Grande",
      legacySheetName: "",
      aliases: "Cloud\nCloud Mujer",
    },
    index
  );

  assert.ok(match.entry);
  assert.notStrictEqual(match.matchType, "unmatched");
  assert.strictEqual(match.entry.supplier_name, "Cloud Mujer 100ML");
});

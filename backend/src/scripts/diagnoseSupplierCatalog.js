require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const path = require("path");
const mongoose = require("mongoose");
const { getCustomRecordModel } = require("../models/CustomRecord");
const {
  loadSupplierCatalogFromCsv,
  buildSupplierCatalogIndex,
  matchSupplierEntryToProduct,
} = require("../services/supplierCatalogService");

function resolveCsvPath(inputPath) {
  if (inputPath) {
    return path.resolve(process.cwd(), inputPath);
  }

  if (process.env.SUPPLIER_CATALOG_CSV_PATH) {
    return path.resolve(process.cwd(), process.env.SUPPLIER_CATALOG_CSV_PATH);
  }

  throw new Error(
    "Indica la ruta del CSV del proveedor como primer argumento o define SUPPLIER_CATALOG_CSV_PATH"
  );
}

async function main() {
  const csvPath = resolveCsvPath(process.argv[2]);
  const dbName = process.env.MIGRATION_TARGET_DB || "test";

  const supplierEntries = await loadSupplierCatalogFromCsv(csvPath);
  const supplierIndex = buildSupplierCatalogIndex(supplierEntries);

  await mongoose.connect(process.env.MONGO_URI, { dbName });

  const Product = getCustomRecordModel("product");
  const products = await Product.find({ isactive: { $ne: false } })
    .sort({ name: 1, _id: 1 })
    .lean();

  const summary = {
    dbName,
    csvPath,
    supplierEntries: supplierEntries.length,
    productsReviewed: products.length,
    matched: 0,
    unmatched: 0,
    offerMatches: 0,
    byMatchType: {
      legacySheetName: 0,
      exact: 0,
      cleaned: 0,
      compact: 0,
      unmatched: 0,
    },
    samples: {
      matched: [],
      unmatched: [],
      offers: [],
    },
  };

  for (const product of products) {
    const match = matchSupplierEntryToProduct(product, supplierIndex);
    summary.byMatchType[match.matchType] += 1;

    if (match.entry) {
      summary.matched += 1;

      if (match.entry.supplier_is_offer) {
        summary.offerMatches += 1;
        if (summary.samples.offers.length < 10) {
          summary.samples.offers.push({
            product: product.name,
            supplier_name: match.entry.supplier_name,
            supplier_price_raw: match.entry.supplier_price_raw,
            supplier_price_value: match.entry.supplier_price_value,
            matchType: match.matchType,
          });
        }
      }

      if (summary.samples.matched.length < 15) {
        summary.samples.matched.push({
          product: product.name,
          legacySheetName: product.legacySheetName || "",
          supplier_name: match.entry.supplier_name,
          supplier_price_raw: match.entry.supplier_price_raw,
          supplier_price_value: match.entry.supplier_price_value,
          supplier_is_offer: match.entry.supplier_is_offer,
          matchType: match.matchType,
          matchedBy: match.matchedBy,
        });
      }
      continue;
    }

    summary.unmatched += 1;
    if (summary.samples.unmatched.length < 20) {
      summary.samples.unmatched.push({
        product: product.name,
        legacySheetName: product.legacySheetName || "",
        aliases: String(product.aliases || "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 5),
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("diagnoseSupplierCatalog error:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

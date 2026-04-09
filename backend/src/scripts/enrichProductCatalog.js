require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const mongoose = require("mongoose");
const { getCustomRecordModel } = require("../models/CustomRecord");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeGender(value, fallbackText = "") {
  const source = `${value || ""} ${fallbackText || ""}`.toLowerCase();
  if (!source.trim()) return "";
  if (source.includes("unisex")) return "Unisex";
  if (source.includes("mujer") || source.includes("women") || source.includes("woman")) {
    return "Mujer";
  }
  if (source.includes("nino") || source.includes("niña") || source.includes("nina") || source.includes("kids")) {
    return "Ninos";
  }
  if (source.includes("hombre") || source.includes("men") || source.includes("man")) {
    return "Hombre";
  }
  return "";
}

function addAlias(set, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return;
  set.add(trimmed);
}

function addNormalizedAliasVariants(set, value) {
  const normalized = normalizeText(value);
  if (!normalized) return;

  addAlias(set, normalized);
  addAlias(set, normalized.toLowerCase());
  addAlias(set, titleCase(normalized));

  const compact = normalized.replace(/\s+/g, "");
  if (compact && compact !== normalized) {
    addAlias(set, compact);
    addAlias(set, compact.toLowerCase());
  }

  const separatedDigits = normalized
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (separatedDigits && separatedDigits !== normalized) {
    addAlias(set, separatedDigits);
    addAlias(set, separatedDigits.toLowerCase());
  }
}

function buildAliases(product) {
  const aliases = new Set();

  addAlias(aliases, product.name);
  addNormalizedAliasVariants(aliases, product.name);

  if (product.brand) {
    addAlias(aliases, `${product.brand} ${product.name}`);
    addAlias(aliases, `${product.name} ${product.brand}`);
    addNormalizedAliasVariants(aliases, `${product.brand} ${product.name}`);
  }

  const legacySheetName = String(product.legacySheetName || "").trim();
  if (legacySheetName) {
    const normalizedSheet = normalizeText(legacySheetName);
    addAlias(aliases, normalizedSheet);

    const cleanedSheet = normalizedSheet
      .replace(/\b\d+\s*ml\b/gi, " ")
      .replace(/\b(edp|edt|parfum|eau de parfum|eau de toilette)\b/gi, " ")
      .replace(/\b(hombre|mujer|unisex|ninos)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanedSheet) {
      addAlias(aliases, cleanedSheet);
      addAlias(aliases, titleCase(cleanedSheet));
    }
  }

  return Array.from(aliases)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 12);
}

async function main() {
  const dbName = process.env.MIGRATION_TARGET_DB || "test";
  await mongoose.connect(process.env.MONGO_URI, { dbName });

  const Product = getCustomRecordModel("product");
  const products = await Product.find({}).sort({ name: 1, _id: 1 }).lean();

  let updated = 0;
  const samples = [];

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const volume =
      product.volume != null && product.volume !== ""
        ? product.volume
        : Number(product.legacyVolume) || null;
    const gender =
      product.gender && String(product.gender).trim()
        ? product.gender
        : normalizeGender(product.legacyGender, product.legacySheetName);
    const aliases = buildAliases(product);
    const sortOrder =
      product.sort_order != null && product.sort_order !== ""
        ? product.sort_order
        : (index + 1) * 10;

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          volume,
          gender,
          sort_order: sortOrder,
          aliases: aliases.join("\n"),
        },
      }
    );

    updated += 1;
    if (samples.length < 10) {
      samples.push({
        name: product.name,
        volume,
        gender,
        sort_order: sortOrder,
        aliases,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dbName,
        total: products.length,
        updated,
        samples,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("enrichProductCatalog error:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

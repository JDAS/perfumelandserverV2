const fs = require("fs/promises");
const path = require("path");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanSupplierName(value) {
  return normalizeText(value)
    .replace(/\b\d+\s*ml\b/gi, " ")
    .replace(/\b(edp|edt|parfum|perfume|eau de parfum|eau de toilette)\b/gi, " ")
    .replace(/\b(hombre|mujer|unisex|ninos|ninas|kids|men|man|women|woman)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => String(cell || "").trim());
}

function parseSupplierPrice(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return {
      raw,
      value: null,
      isOffer: false,
    };
  }

  const normalized = raw
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  const match = normalized.match(/(\d[\d,]*)/);
  const numericToken = match ? match[1].replace(/,/g, "") : "";
  const value = numericToken ? Number(numericToken) : null;

  return {
    raw,
    value: Number.isFinite(value) ? value : null,
    isOffer: /\boferta\b/i.test(normalized),
  };
}

function parseSupplierCatalogCsv(csvText) {
  const lines = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  const entries = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!String(line || "").trim()) continue;

    const cells = parseCsvLine(line);
    if (!cells.length) continue;

    const supplierName = String(cells[0] || "").trim();
    const lastNonEmptyCell = [...cells].reverse().find((cell) => String(cell || "").trim());
    const parsedPrice = parseSupplierPrice(lastNonEmptyCell);

    if (!supplierName || parsedPrice.value == null) continue;

    const normalizedName = normalizeText(supplierName);
    const cleanedName = cleanSupplierName(supplierName);
    if (!normalizedName) continue;

    entries.push({
      supplier_name: supplierName,
      supplier_name_normalized: normalizedName,
      supplier_name_cleaned: cleanedName,
      supplier_name_compact: compactText(supplierName),
      supplier_price_raw: parsedPrice.raw,
      supplier_price_value: parsedPrice.value,
      supplier_is_offer: parsedPrice.isOffer,
      source_row_number: lineIndex + 1,
    });
  }

  return entries;
}

async function loadSupplierCatalogFromCsv(filePath) {
  const csvText = await fs.readFile(filePath, "utf8");
  return parseSupplierCatalogCsv(csvText);
}

function resolveSupplierCatalogCsvPath(inputPath) {
  if (inputPath) {
    return path.resolve(process.cwd(), inputPath);
  }

  if (process.env.SUPPLIER_CATALOG_CSV_PATH) {
    return path.resolve(process.cwd(), process.env.SUPPLIER_CATALOG_CSV_PATH);
  }

  throw new Error(
    "Configura SUPPLIER_CATALOG_CSV_PATH o indica la ruta del CSV del proveedor"
  );
}

function addCandidate(set, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return;

  set.add(trimmed);
  set.add(normalizeText(trimmed));
  set.add(cleanSupplierName(trimmed));
  set.add(compactText(trimmed));
}

function splitAliases(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProductSupplierKeys(product) {
  const keys = new Set();

  addCandidate(keys, product.name);
  addCandidate(keys, product.legacySheetName);

  if (product.brand && product.name) {
    addCandidate(keys, `${product.brand} ${product.name}`);
    addCandidate(keys, `${product.name} ${product.brand}`);
  }

  for (const alias of splitAliases(product.aliases)) {
    addCandidate(keys, alias);
  }

  return Array.from(keys).filter(Boolean);
}

function pushIndex(map, key, entry) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;

  if (!map.has(normalizedKey)) {
    map.set(normalizedKey, []);
  }

  map.get(normalizedKey).push(entry);
}

function buildSupplierCatalogIndex(entries) {
  const exact = new Map();
  const cleaned = new Map();
  const compact = new Map();

  for (const entry of entries) {
    pushIndex(exact, entry.supplier_name_normalized, entry);
    pushIndex(cleaned, entry.supplier_name_cleaned, entry);
    pushIndex(compact, entry.supplier_name_compact, entry);
  }

  return { exact, cleaned, compact };
}

function pickUniqueEntry(candidates) {
  return Array.isArray(candidates) && candidates.length === 1 ? candidates[0] : null;
}

function matchSupplierEntryToProduct(product, supplierIndexOrEntries) {
  const supplierIndex = Array.isArray(supplierIndexOrEntries)
    ? buildSupplierCatalogIndex(supplierIndexOrEntries)
    : supplierIndexOrEntries;

  const keys = buildProductSupplierKeys(product);

  const exactLegacyKey = normalizeText(product.legacySheetName);
  if (exactLegacyKey) {
    const exactLegacy = pickUniqueEntry(supplierIndex.exact.get(exactLegacyKey));
    if (exactLegacy) {
      return {
        entry: exactLegacy,
        matchType: "legacySheetName",
        matchedBy: product.legacySheetName,
      };
    }
  }

  for (const key of keys) {
    const exact = pickUniqueEntry(supplierIndex.exact.get(normalizeText(key)));
    if (exact) {
      return {
        entry: exact,
        matchType: "exact",
        matchedBy: key,
      };
    }
  }

  for (const key of keys) {
    const cleaned = pickUniqueEntry(supplierIndex.cleaned.get(cleanSupplierName(key)));
    if (cleaned) {
      return {
        entry: cleaned,
        matchType: "cleaned",
        matchedBy: key,
      };
    }
  }

  for (const key of keys) {
    const compact = pickUniqueEntry(supplierIndex.compact.get(compactText(key)));
    if (compact) {
      return {
        entry: compact,
        matchType: "compact",
        matchedBy: key,
      };
    }
  }

  return {
    entry: null,
    matchType: "unmatched",
    matchedBy: "",
  };
}

module.exports = {
  normalizeText,
  cleanSupplierName,
  parseSupplierPrice,
  parseSupplierCatalogCsv,
  loadSupplierCatalogFromCsv,
  resolveSupplierCatalogCsvPath,
  buildProductSupplierKeys,
  buildSupplierCatalogIndex,
  matchSupplierEntryToProduct,
};

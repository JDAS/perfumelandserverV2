const Product = require("../models/Product");
const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { applyFormulaFields } = require("../utils/formulaEngine");

function normalizeLegacyProduct(product) {
  return {
    _id: product._id,
    name: product.name || "",
    brand: product.brand || "",
    price: Number(product.price) || 0,
    description: product.description || "",
    image: product.image || "",
    gallery: product.image ? [product.image] : [],
    category: product.category || "",
    short_description: product.short_description || "",
    featured: Boolean(product.featured),
    sort_order: Number(product.sort_order) || 0,
    volume: product.volume || null,
    gender: product.gender || "",
    aliases: product.aliases || "",
    source: "legacy",
  };
}

function normalizeDynamicProduct(product) {
  return {
    _id: product._id,
    name: product.name || "",
    brand: product.brand || "",
    price: Number(product.price) || 0,
    oldprice: product.oldprice || 0,
    description: product.description || "",
    short_description: product.short_description || "",
    image: product.image || "",
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    category: product.category || "",
    featured: Boolean(product.featured),
    sort_order: Number(product.sort_order) || 0,
    volume: product.volume || null,
    gender: product.gender || "",
    aliases: product.aliases || "",
    isactive: product.isactive !== false,
    catalog_status: product.catalog_status || "Listo para catalogo",
    source: "dynamic",
  };
}

function isCloudinaryUrl(value) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(String(value || ""));
}

async function loadDynamicProductContext() {
  const objectDefinition = await CustomObject.findOne({ apiName: "product" }).lean();
  if (!objectDefinition) {
    return {
      objectDefinition: null,
      rawProducts: [],
      attachments: [],
    };
  }

  const ProductRecord = getCustomRecordModel("product");
  const AttachmentRecord = getCustomRecordModel("attachments");

  const rawProducts = await ProductRecord.find({
    isactive: { $ne: false },
    $or: [
      { catalog_status: "Listo para catalogo" },
      { catalog_status: { $exists: false } },
      { catalog_status: null },
      { catalog_status: "" },
    ],
  })
    .sort({ sort_order: 1, featured: -1, createdAt: -1, _id: -1 })
    .lean();

  if (!rawProducts.length) {
    return {
      objectDefinition,
      rawProducts: [],
      attachments: [],
    };
  }

  const productIds = rawProducts.map((item) => String(item._id));

  const attachments = await AttachmentRecord.find({
    linked_object: "product",
    $or: [
      { linked_record_id: { $in: productIds } },
      { linkedrecordid: { $in: productIds } },
    ],
    isactive: { $ne: false },
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  return {
    objectDefinition,
    rawProducts,
    attachments,
  };
}

function buildDynamicProducts(rawProducts, objectDefinition, attachments) {
  if (!rawProducts.length || !objectDefinition) return [];

  const imagesByProductId = new Map();

  for (const attachment of attachments) {
    const linkedId = String(
      attachment.linked_record_id || attachment.linkedrecordid || ""
    );

    if (!linkedId) continue;

    const fileUrl = attachment.file_url || attachment.url || "";
    if (!fileUrl) continue;

    if (!imagesByProductId.has(linkedId)) {
      imagesByProductId.set(linkedId, []);
    }

    imagesByProductId.get(linkedId).push({
      fileUrl,
      priority: isCloudinaryUrl(fileUrl) ? 0 : 1,
    });
  }

  return rawProducts.map((product) => {
    const enriched = applyFormulaFields(objectDefinition.fields, product);
    const gallery = (imagesByProductId.get(String(product._id)) || [])
      .sort((a, b) => a.priority - b.priority)
      .map((item) => item.fileUrl);

    return normalizeDynamicProduct({
      ...enriched,
      image: gallery[0] || enriched.image || product.image || "",
      gallery,
    });
  });
}

async function loadDynamicProducts() {
  const { objectDefinition, rawProducts, attachments } =
    await loadDynamicProductContext();

  return buildDynamicProducts(rawProducts, objectDefinition, attachments);
}

// Crear producto
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos
exports.getProducts = async (req, res) => {
  try {
    const [legacyProducts, dynamicProducts] = await Promise.all([
      Product.find().sort({ createdAt: -1, _id: -1 }).lean(),
      loadDynamicProducts(),
    ]);

    if (dynamicProducts.length > 0) {
      return res.json(dynamicProducts);
    }

    return res.json(legacyProducts.map(normalizeLegacyProduct));
  } catch (error) {
    console.error("getProducts error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const dynamicProducts = await loadDynamicProducts();
    const dynamicMatch = dynamicProducts.find((product) => String(product._id) === String(id));

    if (dynamicMatch) {
      return res.json(dynamicMatch);
    }

    const legacyProduct = await Product.findById(id).lean();
    if (legacyProduct) {
      return res.json(normalizeLegacyProduct(legacyProduct));
    }

    return res.status(404).json({ error: "Producto no encontrado" });
  } catch (error) {
    console.error("getProductById error:", error);
    return res.status(500).json({ error: error.message });
  }
};

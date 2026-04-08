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
    category: product.category || "",
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
    image: product.image || "",
    category: product.category || "",
    isactive: product.isactive !== false,
    source: "dynamic",
  };
}

async function loadDynamicProducts() {
  const objectDefinition = await CustomObject.findOne({ apiName: "product" }).lean();
  if (!objectDefinition) return [];

  const ProductRecord = getCustomRecordModel("product");
  const AttachmentRecord = getCustomRecordModel("attachments");

  const rawProducts = await ProductRecord.find({ isactive: { $ne: false } })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  if (!rawProducts.length) return [];

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

  const imageByProductId = new Map();

  for (const attachment of attachments) {
    const linkedId = String(
      attachment.linked_record_id || attachment.linkedrecordid || ""
    );

    if (!linkedId || imageByProductId.has(linkedId)) continue;

    imageByProductId.set(linkedId, attachment.file_url || attachment.url || "");
  }

  return rawProducts.map((product) => {
    const enriched = applyFormulaFields(objectDefinition.fields, product);
    return normalizeDynamicProduct({
      ...enriched,
      image:
        imageByProductId.get(String(product._id)) ||
        enriched.image ||
        product.image ||
        "",
    });
  });
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

const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { saveRecord } = require("../services/customRecordService");
const { applyFormulaFields } = require("../utils/formulaEngine");
const { createHttpError } = require("../utils/httpError");

const DYNAMIC_PRODUCT_CATALOG_FILTER = {
  isactive: { $ne: false },
  $or: [
    { catalog_status: "Listo para catalogo" },
    { catalog_status: { $exists: false } },
    { catalog_status: null },
    { catalog_status: "" },
  ],
};

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getConfiguredPublicBaseUrl() {
  const candidates = [
    process.env.FRONTEND_APP_URL,
    process.env.PUBLIC_APP_URL,
    ...(process.env.CORS_ORIGIN || "").split(","),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      return new URL(candidate).toString().replace(/\/+$/, "");
    } catch (_error) {
      continue;
    }
  }

  return "";
}

function getPublicBaseUrl(req) {
  const configuredBaseUrl = getConfiguredPublicBaseUrl();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw createHttpError(
      500,
      "Configura FRONTEND_APP_URL o PUBLIC_APP_URL para generar enlaces publicos seguros"
    );
  }

  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
}

function buildSharePage(product, req) {
  const publicBaseUrl = getPublicBaseUrl(req);
  const appUrl = `${publicBaseUrl}/products/${product._id}`;
  const shareUrl = `${publicBaseUrl}/api/products/share/${product._id}`;
  const imageUrl = product.image || "/logoName.png";
  const absoluteImage = /^https?:\/\//i.test(imageUrl)
    ? imageUrl
    : `${publicBaseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
  const title = `${product.name} | Perfumeland`;
  const description =
    product.short_description ||
    product.description ||
    `${product.name} de ${product.brand || "Perfumeland"} disponible para cotizar en Perfumeland.`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(absoluteImage)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(absoluteImage)}" />
    <meta http-equiv="refresh" content="1; url=${escapeHtml(appUrl)}" />
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6f8ff;
        color: #102750;
      }
      .card {
        width: min(92vw, 560px);
        background: #fff;
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 20px 60px rgba(13, 47, 107, 0.12);
        text-align: center;
      }
      img {
        max-width: 220px;
        max-height: 220px;
        object-fit: contain;
        margin-bottom: 18px;
      }
      a {
        color: #0d2f6b;
        font-weight: 700;
        text-decoration: none;
      }
      p {
        color: #5e6682;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <img src="${escapeHtml(absoluteImage)}" alt="${escapeHtml(product.name)}" />
      <h1>${escapeHtml(product.name)}</h1>
      <p>${escapeHtml(description)}</p>
      <p>Abriendo el producto...</p>
      <a href="${escapeHtml(appUrl)}">Abrir en Perfumeland</a>
    </main>
  </body>
</html>`;
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

  const rawProducts = await ProductRecord.find(DYNAMIC_PRODUCT_CATALOG_FILTER)
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

async function loadDynamicProductById(productId) {
  const objectDefinition = await CustomObject.findOne({ apiName: "product" }).lean();
  if (!objectDefinition) return null;

  const ProductRecord = getCustomRecordModel("product");
  const AttachmentRecord = getCustomRecordModel("attachments");

  const rawProduct = await ProductRecord.findOne({
    _id: productId,
    ...DYNAMIC_PRODUCT_CATALOG_FILTER,
  }).lean();

  if (!rawProduct) return null;

  const linkedId = String(rawProduct._id);
  const attachments = await AttachmentRecord.find({
    linked_object: "product",
    $or: [
      { linked_record_id: linkedId },
      { linkedrecordid: linkedId },
    ],
    isactive: { $ne: false },
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  return buildDynamicProducts([rawProduct], objectDefinition, attachments)[0] || null;
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
  const result = await saveRecord({
    objectApiName: "product",
    payload: req.body,
    user: req.user || null,
  });

  const createdProduct = await loadDynamicProductById(String(result.record?._id || ""));
  res.status(201).json(createdProduct || result.record);
};

// Obtener todos
exports.getProducts = async (req, res) => {
  const dynamicProducts = await loadDynamicProducts();
  return res.json(dynamicProducts);
};

exports.getProductById = async (req, res) => {
  const { id } = req.params;

  const dynamicProduct = await loadDynamicProductById(id);
  if (dynamicProduct) {
    return res.json(dynamicProduct);
  }

  throw createHttpError(404, "Producto no encontrado");
};

exports.getProductSharePage = async (req, res) => {
  try {
    const { id } = req.params;

    const dynamicProduct = await loadDynamicProductById(id);
    if (dynamicProduct) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildSharePage(dynamicProduct, req));
    }

    return res.status(404).send("Producto no encontrado");
  } catch (error) {
    console.error("getProductSharePage error:", error);
    return res.status(500).send("No se pudo generar la vista para compartir");
  }
};

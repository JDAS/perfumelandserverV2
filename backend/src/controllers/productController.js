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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFrontendBaseUrl(req) {
  const configured =
    process.env.FRONTEND_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.CORS_ORIGIN ||
    "";

  const normalizedConfigured = configured
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  if (normalizedConfigured) {
    return normalizedConfigured.replace(/\/+$/, "");
  }

  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
}

function buildSharePage(product, req) {
  const frontendBaseUrl = getFrontendBaseUrl(req);
  const appUrl = `${frontendBaseUrl}/products/${product._id}`;
  const shareUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const imageUrl = product.image || "/logoName.png";
  const absoluteImage = /^https?:\/\//i.test(imageUrl)
    ? imageUrl
    : `${frontendBaseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
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
    <script>
      window.location.replace(${JSON.stringify(appUrl)});
    </script>
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

exports.getProductSharePage = async (req, res) => {
  try {
    const { id } = req.params;

    const dynamicProducts = await loadDynamicProducts();
    const dynamicMatch = dynamicProducts.find((product) => String(product._id) === String(id));

    if (dynamicMatch) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildSharePage(dynamicMatch, req));
    }

    const legacyProduct = await Product.findById(id).lean();
    if (legacyProduct) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildSharePage(normalizeLegacyProduct(legacyProduct), req));
    }

    return res.status(404).send("Producto no encontrado");
  } catch (error) {
    console.error("getProductSharePage error:", error);
    return res.status(500).send("No se pudo generar la vista para compartir");
  }
};

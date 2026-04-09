const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

const SOURCE_DB_NAME = process.env.MIGRATION_SOURCE_DB || "perfumeland";
const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";

function normalizeString(value) {
  return String(value || "").trim();
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return Boolean(value);
}

function slugify(value) {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapLegacyProduct(legacyProduct) {
  return {
    name: normalizeString(legacyProduct.name),
    brand: normalizeString(legacyProduct.brand),
    price: Number(legacyProduct.price) || 0,
    oldprice: Number(legacyProduct.oldPrice) || Number(legacyProduct.price) || 0,
    description: normalizeString(legacyProduct.description),
    isactive: toBoolean(legacyProduct.active, true),
    legacyId: String(legacyProduct._id),
    legacySheetName: normalizeString(legacyProduct.sheetName),
    legacyVolume: legacyProduct.volume ?? null,
    legacyGender: normalizeString(legacyProduct.gender),
    legacyWholesalePrice: Number(legacyProduct.wholesalePrice) || 0,
    legacyPopularity: Number(legacyProduct.popularity) || 0,
    legacyIntensity: normalizeString(legacyProduct.intensity),
    legacyCategories: Array.isArray(legacyProduct.categories)
      ? legacyProduct.categories
      : [],
    legacyOnSale: toBoolean(legacyProduct.onSale, false),
    legacyImages: Array.isArray(legacyProduct.images)
      ? legacyProduct.images.map((image) => ({
          alt: normalizeString(image?.alt),
          url: normalizeString(image?.url),
        }))
      : [],
  };
}

function mapLegacySeller(legacySeller) {
  return {
    name: normalizeString(legacySeller.name),
    isactive: true,
    legacyId: String(legacySeller._id),
    legacySlug: slugify(legacySeller.name),
  };
}

function normalizeNameKey(value) {
  return slugify(value);
}

function mapLegacySaleType(type) {
  const normalized = normalizeString(type).toLowerCase();
  if (normalized === "contado") return "Contado";
  if (normalized === "credito" || normalized === "crédito") return "Credito";
  if (normalized === "tablas") return "Credito";
  return "Credito";
}

function mapLegacyCreditType(creditType) {
  const normalized = normalizeString(creditType).toLowerCase();
  if (!normalized) return "";
  if (normalized === "normal") return "Normal";
  if (normalized === "2 pagos" || normalized === "dos pagos") return "Dos pagos";
  if (normalized === "extendido") return "Extendido";
  if (normalized === "extendido especial") return "Extendido especial";
  return "";
}

function inferPaymentPlanStatus(payment) {
  const expected = Number(payment?.expectedAmount) || 0;
  const paid = Number(payment?.amountPaid) || 0;
  const dueDate = normalizeString(payment?.fecha);

  if (payment?.paid || (expected > 0 && paid >= expected)) return "Paid";
  if (paid > 0) return "Partial";

  if (dueDate) {
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const [year, month, day] = dueDate.split("-").map(Number);
    const due = new Date(year, (month || 1) - 1, day || 1);
    if (!Number.isNaN(due.getTime()) && due < localToday) {
      return "Overdue";
    }
  }

  return "Pending";
}

function inferSalePaymentStatus({ saleStatus, total, totalPaid }) {
  if (saleStatus === "Cancelada") return "Cancelada";
  if (saleStatus === "Borrador") return "Borrador";

  const safeTotal = Number(total) || 0;
  const safePaid = Number(totalPaid) || 0;

  if (safeTotal > 0 && safePaid >= safeTotal) return "Pagada";
  if (safePaid > 0) return "Parcial";
  return "Pendiente";
}

async function connectToDatabase(dbName) {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no esta definida.");
  }

  const connection = await mongoose.createConnection(process.env.MONGO_URI, {
    dbName,
  }).asPromise();

  return connection;
}

async function getTargetCustomObject(targetConnection, apiName) {
  return targetConnection.collection("customobjects").findOne({ apiName });
}

function getCustomRecordModelForConnection(connection, objectName) {
  const modelName = `migration_${connection.name}_${objectName}`;

  if (connection.models[modelName]) {
    return connection.models[modelName];
  }

  const schema = new mongoose.Schema({}, { strict: false, timestamps: true });
  return connection.model(modelName, schema, objectName);
}

async function migrateCollection({
  sourceConnection,
  targetConnection,
  sourceCollectionName,
  targetObjectApiName,
  mapper,
  uniqueKey,
  dryRun,
}) {
  const objectDefinition = await getTargetCustomObject(targetConnection, targetObjectApiName);

  if (!objectDefinition && !dryRun) {
    throw new Error(
      `No existe el CustomObject destino "${targetObjectApiName}" en ${targetConnection.name}.`
    );
  }

  const sourceDocs = await sourceConnection.collection(sourceCollectionName).find({}).toArray();
  const TargetModel = getCustomRecordModelForConnection(targetConnection, targetObjectApiName);

  let inserted = 0;
  let updated = 0;
  const samples = [];

  for (const sourceDoc of sourceDocs) {
    const payload = mapper(sourceDoc);
    if (samples.length < 5) {
      samples.push(payload);
    }

    if (dryRun) continue;

    const query = uniqueKey ? { [uniqueKey]: payload[uniqueKey] } : { legacyId: payload.legacyId };
    const existing = await TargetModel.findOne(query);

    if (existing) {
      existing.set({ ...existing.toObject(), ...payload });
      Object.keys(payload).forEach((key) => existing.markModified(key));
      await existing.save();
      updated += 1;
      continue;
    }

    await TargetModel.create(payload);
    inserted += 1;
  }

  return {
    sourceCollectionName,
    targetObjectApiName,
    targetExists: Boolean(objectDefinition),
    totalSource: sourceDocs.length,
    inserted,
    updated,
    dryRun,
    samples,
  };
}

async function migrateLegacyProductAttachments({
  sourceConnection,
  targetConnection,
  dryRun,
}) {
  const attachmentsObject = await getTargetCustomObject(targetConnection, "attachments");
  const productObject = await getTargetCustomObject(targetConnection, "product");

  const sourceDocs = await sourceConnection.collection("products").find({}).toArray();
  const samples = [];

  if (!attachmentsObject || !productObject) {
    return {
      sourceCollectionName: "products.images",
      targetObjectApiName: "attachments",
      targetExists: Boolean(attachmentsObject && productObject),
      totalSourceProducts: sourceDocs.length,
      totalSourceImages: sourceDocs.reduce(
        (acc, product) => acc + (Array.isArray(product.images) ? product.images.length : 0),
        0
      ),
      linkedProductsFound: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      dryRun,
      samples,
    };
  }

  const ProductModel = getCustomRecordModelForConnection(targetConnection, "product");
  const AttachmentModel = getCustomRecordModelForConnection(targetConnection, "attachments");

  const migratedProducts = await ProductModel.find(
    { legacyId: { $exists: true } },
    { _id: 1, legacyId: 1, name: 1 }
  ).lean();

  const productByLegacyId = new Map(
    migratedProducts.map((product) => [String(product.legacyId), product])
  );

  let linkedProductsFound = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const legacyProduct of sourceDocs) {
    const targetProduct = productByLegacyId.get(String(legacyProduct._id));
    const images = Array.isArray(legacyProduct.images) ? legacyProduct.images : [];

    if (!images.length) continue;

    if (targetProduct) {
      linkedProductsFound += 1;
    }

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const fileUrl = normalizeString(image?.url);

      if (!targetProduct || !fileUrl) {
        skipped += 1;
        continue;
      }

      const fileName = fileUrl.split("/").pop() || `image-${index + 1}.jpg`;
      const payload = {
        name: `${normalizeString(legacyProduct.name) || "Producto"} imagen ${index + 1}`,
        file_name: fileName,
        file_url: fileUrl,
        mimetype: fileName.toLowerCase().endsWith(".png")
          ? "image/png"
          : fileName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg",
        linked_object: "product",
        linked_record_id: String(targetProduct._id),
        isactive: true,
        legacyOwnerId: String(legacyProduct._id),
        legacyImageIndex: index,
      };

      if (samples.length < 5) {
        samples.push(payload);
      }

      if (dryRun) continue;

      const existing = await AttachmentModel.findOne({
        linked_object: "product",
        linked_record_id: String(targetProduct._id),
        file_url: fileUrl,
      });

      if (existing) {
        existing.set({ ...existing.toObject(), ...payload });
        Object.keys(payload).forEach((key) => existing.markModified(key));
        await existing.save();
        updated += 1;
        continue;
      }

      await AttachmentModel.create(payload);
      inserted += 1;
    }
  }

  return {
    sourceCollectionName: "products.images",
    targetObjectApiName: "attachments",
    targetExists: true,
    totalSourceProducts: sourceDocs.length,
    totalSourceImages: sourceDocs.reduce(
      (acc, product) => acc + (Array.isArray(product.images) ? product.images.length : 0),
      0
    ),
    linkedProductsFound,
    inserted,
    updated,
    skipped,
    dryRun,
    samples,
  };
}

async function inspectSalesShape(sourceConnection) {
  const sales = await sourceConnection.collection("sales").find({}).toArray();

  const summary = {
    totalSales: sales.length,
    typeCounts: {},
    creditTypeCounts: {},
    sellers: new Set(),
    paymentsPatterns: {
      withPayments: 0,
      withoutPayments: 0,
    },
    productsArrayLengths: {},
    sampleSales: sales.slice(0, 5).map((sale) => ({
      _id: String(sale._id),
      client: sale.client,
      type: sale.type,
      creditType: sale.creditType,
      quotes: sale.quotes,
      seller: sale.seller,
      totalSales: sale.totalSales,
      productCount: Array.isArray(sale.products) ? sale.products.length : 0,
      paymentCount: Array.isArray(sale.payments) ? sale.payments.length : 0,
    })),
  };

  for (const sale of sales) {
    const type = normalizeString(sale.type).toLowerCase() || "sin_tipo";
    const creditType = normalizeString(sale.creditType).toLowerCase() || "sin_credito";
    const productCount = Array.isArray(sale.products) ? sale.products.length : 0;

    summary.typeCounts[type] = (summary.typeCounts[type] || 0) + 1;
    summary.creditTypeCounts[creditType] = (summary.creditTypeCounts[creditType] || 0) + 1;
    summary.productsArrayLengths[productCount] =
      (summary.productsArrayLengths[productCount] || 0) + 1;

    if (Array.isArray(sale.payments) && sale.payments.length > 0) {
      summary.paymentsPatterns.withPayments += 1;
    } else {
      summary.paymentsPatterns.withoutPayments += 1;
    }

    if (sale.seller) {
      summary.sellers.add(normalizeString(sale.seller));
    }
  }

  return {
    ...summary,
    sellers: [...summary.sellers].sort((a, b) => a.localeCompare(b)),
  };
}

async function ensureTargetSellerMap({
  sourceConnection,
  targetConnection,
  dryRun,
}) {
  const SellerModel = getCustomRecordModelForConnection(targetConnection, "seller");
  const targetSellers = await SellerModel.find({}, { _id: 1, name: 1, legacyId: 1 }).lean();

  const byLegacyId = new Map();
  const byName = new Map();

  for (const seller of targetSellers) {
    if (seller.legacyId) {
      byLegacyId.set(String(seller.legacyId), seller);
    }

    if (seller.name) {
      byName.set(normalizeNameKey(seller.name), seller);
    }
  }

  const sourceSellerDocs = await sourceConnection.collection("sellers").find({}).toArray();
  const salesSellerNames = await sourceConnection.collection("sales").distinct("seller");

  const missingNames = salesSellerNames
    .map(normalizeString)
    .filter(Boolean)
    .filter((name) => !byName.has(normalizeNameKey(name)));

  const created = [];

  if (!dryRun) {
    for (const name of missingNames) {
      const payload = {
        name,
        isactive: true,
        legacySlug: slugify(name),
      };

      const createdSeller = await SellerModel.create(payload);
      const plain = createdSeller.toObject();
      byName.set(normalizeNameKey(name), plain);
      created.push({ name });
    }
  }

  const refreshedSellers = dryRun
    ? targetSellers
    : await SellerModel.find({}, { _id: 1, name: 1, legacyId: 1 }).lean();

  const refreshedByLegacyId = new Map();
  const refreshedByName = new Map();

  for (const seller of refreshedSellers) {
    if (seller.legacyId) {
      refreshedByLegacyId.set(String(seller.legacyId), seller);
    }

    if (seller.name) {
      refreshedByName.set(normalizeNameKey(seller.name), seller);
    }
  }

  for (const sourceSeller of sourceSellerDocs) {
    const key = normalizeNameKey(sourceSeller.name);
    if (!refreshedByName.has(key) && dryRun) continue;

    const matched = refreshedByName.get(key);
    if (matched) {
      refreshedByLegacyId.set(String(sourceSeller._id), matched);
    }
  }

  return {
    byLegacyId: refreshedByLegacyId,
    byName: refreshedByName,
    created,
    missingNames,
  };
}

async function migrateLegacySalesPhase({
  sourceConnection,
  targetConnection,
  dryRun,
}) {
  const salesObject = await getTargetCustomObject(targetConnection, "sales");
  const saleItemObject = await getTargetCustomObject(targetConnection, "sale_item");
  const paymentPlanObject = await getTargetCustomObject(targetConnection, "payment_plan");
  const paymentObject = await getTargetCustomObject(targetConnection, "payment");

  const sourceSales = await sourceConnection.collection("sales").find({}).toArray();

  const summary = {
    targetExists: Boolean(salesObject && saleItemObject && paymentPlanObject && paymentObject),
    totalSource: sourceSales.length,
    salesInserted: 0,
    salesUpdated: 0,
    saleItemsInserted: 0,
    saleItemsUpdated: 0,
    paymentPlansInserted: 0,
    paymentPlansUpdated: 0,
    paymentsInserted: 0,
    paymentsUpdated: 0,
    skippedSaleItems: 0,
    placeholderSellersCreated: 0,
    dryRun,
    samples: [],
  };

  if (!summary.targetExists && !dryRun) {
    throw new Error("Faltan objetos destino para migrar ventas.");
  }

  const SalesModel = getCustomRecordModelForConnection(targetConnection, "sales");
  const SaleItemModel = getCustomRecordModelForConnection(targetConnection, "sale_item");
  const PaymentPlanModel = getCustomRecordModelForConnection(targetConnection, "payment_plan");
  const PaymentModel = getCustomRecordModelForConnection(targetConnection, "payment");
  const ProductModel = getCustomRecordModelForConnection(targetConnection, "product");

  const products = await ProductModel.find({}, { _id: 1, legacyId: 1, name: 1 }).lean();
  const productByLegacyId = new Map();
  const productByName = new Map();

  for (const product of products) {
    if (product.legacyId) {
      productByLegacyId.set(String(product.legacyId), product);
    }
    if (product.name) {
      productByName.set(normalizeNameKey(product.name), product);
    }
  }

  const sellerMap = await ensureTargetSellerMap({
    sourceConnection,
    targetConnection,
    dryRun,
  });
  summary.placeholderSellersCreated = dryRun ? sellerMap.missingNames.length : sellerMap.created.length;

  for (const legacySale of sourceSales) {
    const sellerName = normalizeString(legacySale.seller);
    const seller =
      sellerMap.byLegacyId.get(String(legacySale.seller || "")) ||
      sellerMap.byName.get(normalizeNameKey(sellerName));

    const mappedCreditType = mapLegacyCreditType(legacySale.creditType);
    const saleStatus = legacySale.canceled ? "Cancelada" : "Completada";
    const saleTotal = Number(legacySale.totalSales) || 0;
    const saleTotalPaid = Number(legacySale.totalPaid) || 0;
    const salePayload = {
      name: normalizeString(legacySale.client) || sellerName || "Venta migrada",
      saledate: normalizeString(legacySale.salesDate) || "",
      status: saleStatus,
      type: mapLegacySaleType(legacySale.type),
      quotes: Number(legacySale.quotes) || 1,
      seller_id: seller ? String(seller._id) : undefined,
      total_paid: saleTotalPaid,
      payment_status: inferSalePaymentStatus({
        saleStatus,
        total: saleTotal,
        totalPaid: saleTotalPaid,
      }),
      legacyId: String(legacySale._id),
      legacyClient: normalizeString(legacySale.client),
      legacySellerName: sellerName,
      legacySourceType: normalizeString(legacySale.type),
      legacyTotalSales: saleTotal,
      legacyTotalPaid: saleTotalPaid,
      legacyOwes: Number(legacySale.owes) || 0,
      legacyCommissionApplies: toBoolean(legacySale.commissionApplies, false),
      legacyCommissionAmount: Number(legacySale.commissionAmount) || 0,
      legacyCommissionPaid: toBoolean(legacySale.commissionPaid, false),
      legacyEstimatedEarnings: Number(legacySale.estimatedEarnings) || 0,
      legacyRealEarnings: Number(legacySale.realEarnings) || 0,
      legacyFullyPaid: toBoolean(legacySale.fullyPaid, false),
      legacyCanceled: toBoolean(legacySale.canceled, false),
    };

    if (mappedCreditType) {
      salePayload.credittype = mappedCreditType;
    }

    if (summary.samples.length < 3) {
      summary.samples.push({
        sale: salePayload,
        products: (legacySale.products || []).slice(0, 2),
        payments: (legacySale.payments || []).slice(0, 2),
      });
    }

    let targetSale = await SalesModel.findOne({ legacyId: String(legacySale._id) });

    if (!dryRun) {
      if (targetSale) {
        targetSale.set({ ...targetSale.toObject(), ...salePayload });
        Object.keys(salePayload).forEach((key) => targetSale.markModified(key));
        await targetSale.save();
        summary.salesUpdated += 1;
      } else {
        targetSale = await SalesModel.create(salePayload);
        summary.salesInserted += 1;
      }
    }

    const saleId = dryRun ? `legacy-sale-${legacySale._id}` : String(targetSale._id);

    const saleProducts = Array.isArray(legacySale.products) ? legacySale.products : [];
    for (let index = 0; index < saleProducts.length; index += 1) {
      const item = saleProducts[index];
      const product =
        productByLegacyId.get(String(item?._id || "")) ||
        productByName.get(normalizeNameKey(item?.name));

      if (!product) {
        summary.skippedSaleItems += 1;
        continue;
      }

      const saleItemPayload = {
        sale: saleId,
        product: String(product._id),
        quantity: Number(item?.quantity) || 1,
        price: Number(item?.unitprice) || Number(item?.total) || 0,
        list_price:
          Number(item?.originalPrice) ||
          Number(item?.unitprice) ||
          Number(item?.total) ||
          0,
        cost_snapshot: Number(item?.wholesalePrice) || 0,
        discount: Number(item?.discount) || 0,
        subtotal:
          (Number(item?.quantity) || 1) *
          (Number(item?.originalPrice) || Number(item?.unitprice) || Number(item?.total) || 0),
        total:
          Number(item?.total) ||
          ((Number(item?.quantity) || 1) *
            (Number(item?.originalPrice) || Number(item?.unitprice) || Number(item?.total) || 0) -
            (Number(item?.discount) || 0)),
        sale_status: saleStatus,
        commission_applies:
          (Number(item?.commission) || 0) > 0 || toBoolean(legacySale.commissionApplies, false),
        legacySaleId: String(legacySale._id),
        legacyLineIndex: index,
        legacyProductName: normalizeString(item?.name),
        legacyProductId: item?._id ? String(item._id) : "",
        legacyOriginalPrice: Number(item?.originalPrice) || 0,
        legacyWholesalePrice: Number(item?.wholesalePrice) || 0,
      };

      if (!dryRun) {
        const existingSaleItem = await SaleItemModel.findOne({
          legacySaleId: String(legacySale._id),
          legacyLineIndex: index,
        });

        if (existingSaleItem) {
          existingSaleItem.set({ ...existingSaleItem.toObject(), ...saleItemPayload });
          Object.keys(saleItemPayload).forEach((key) => existingSaleItem.markModified(key));
          await existingSaleItem.save();
          summary.saleItemsUpdated += 1;
        } else {
          await SaleItemModel.create(saleItemPayload);
          summary.saleItemsInserted += 1;
        }
      }
    }

    const salePayments = Array.isArray(legacySale.payments) ? legacySale.payments : [];
    for (let index = 0; index < salePayments.length; index += 1) {
      const payment = salePayments[index];
      const installmentNumber = Number(payment?.number) || index + 1;
      const paidAmount = Number(payment?.amountPaid) || 0;
      const paymentPlanPayload = {
        sale_id: saleId,
        due_date: normalizeString(payment?.fecha) || "",
        planned_amount: Number(payment?.expectedAmount) || 0,
        installment_number: installmentNumber,
        paid_amount: paidAmount,
        status: inferPaymentPlanStatus(payment),
        version: 1,
        legacySaleId: String(legacySale._id),
        legacyInstallmentNumber: installmentNumber,
      };

      if (paidAmount > 0) {
        paymentPlanPayload.last_payment_date = normalizeString(payment?.fecha) || "";
      }

      let targetPlan = null;

      if (!dryRun) {
        targetPlan = await PaymentPlanModel.findOne({
          legacySaleId: String(legacySale._id),
          legacyInstallmentNumber: installmentNumber,
        });

        if (targetPlan) {
          targetPlan.set({ ...targetPlan.toObject(), ...paymentPlanPayload });
          Object.keys(paymentPlanPayload).forEach((key) => targetPlan.markModified(key));
          await targetPlan.save();
          summary.paymentPlansUpdated += 1;
        } else {
          targetPlan = await PaymentPlanModel.create(paymentPlanPayload);
          summary.paymentPlansInserted += 1;
        }
      }

      if (paidAmount > 0 && !dryRun) {
        const paymentPayload = {
          sale_id: saleId,
          payment_plan_id: String(targetPlan._id),
          amount: paidAmount,
          date: normalizeString(payment?.fecha) || "",
          legacySaleId: String(legacySale._id),
          legacyInstallmentNumber: installmentNumber,
        };

        const existingPayment = await PaymentModel.findOne({
          legacySaleId: String(legacySale._id),
          legacyInstallmentNumber: installmentNumber,
        });

        if (existingPayment) {
          existingPayment.set({ ...existingPayment.toObject(), ...paymentPayload });
          Object.keys(paymentPayload).forEach((key) => existingPayment.markModified(key));
          await existingPayment.save();
          summary.paymentsUpdated += 1;
        } else {
          await PaymentModel.create(paymentPayload);
          summary.paymentsInserted += 1;
        }
      }
    }
  }

  const completedSaleItemTotals = await SaleItemModel.aggregate([
    {
      $match: {
        sale_status: "Completada",
      },
    },
    {
      $group: {
        _id: "$product",
        totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
      },
    },
  ]);

  const soldByProduct = new Map(
    completedSaleItemTotals.map((item) => [String(item._id), Number(item.totalQuantity || 0)])
  );

  const productBulkOps = products.map((product) => ({
    updateOne: {
      filter: { _id: String(product._id) },
      update: {
        $set: {
          sold: soldByProduct.get(String(product._id)) || 0,
        },
      },
    },
  }));

  if (!dryRun && productBulkOps.length > 0) {
    await ProductModel.bulkWrite(productBulkOps);
  }

  return summary;
}

async function main() {
  const dryRun = !process.argv.includes("--write");
  const sourceConnection = await connectToDatabase(SOURCE_DB_NAME);
  const targetConnection = await connectToDatabase(TARGET_DB_NAME);

  console.log(
    `Migracion ${dryRun ? "dry-run" : "write"}: source=${sourceConnection.name} -> target=${targetConnection.name}`
  );

  const productResult = await migrateCollection({
    sourceConnection,
    targetConnection,
    sourceCollectionName: "products",
    targetObjectApiName: "product",
    mapper: mapLegacyProduct,
    uniqueKey: "legacyId",
    dryRun,
  });

  const sellerTarget =
    (await getTargetCustomObject(targetConnection, "seller"))
      ? "seller"
      : (await getTargetCustomObject(targetConnection, "sellers"))
      ? "sellers"
      : null;

  if (!sellerTarget && !dryRun) {
    throw new Error(`No existe el CustomObject destino "seller" o "sellers" en ${targetConnection.name}.`);
  }

  const sellerResult = await migrateCollection({
    sourceConnection,
    targetConnection,
    sourceCollectionName: "sellers",
    targetObjectApiName: sellerTarget || "seller",
    mapper: mapLegacySeller,
    uniqueKey: "legacyId",
    dryRun,
  });

  const attachmentResult = await migrateLegacyProductAttachments({
    sourceConnection,
    targetConnection,
    dryRun,
  });

  const salesMigrationResult = await migrateLegacySalesPhase({
    sourceConnection,
    targetConnection,
    dryRun,
  });

  const salesShape = await inspectSalesShape(sourceConnection);

  console.log(
    JSON.stringify(
      {
        dryRun,
        sourceDb: sourceConnection.name,
        targetDb: targetConnection.name,
        productResult,
        sellerResult,
        attachmentResult,
        salesMigrationResult,
        salesShape,
        nextStep:
          "La fase 2 ya queda mapeada; ahora podemos validar integridad y luego depurar reglas de negocio especiales.",
      },
      null,
      2
    )
  );

  await sourceConnection.close();
  await targetConnection.close();
}

main().catch(async (error) => {
  console.error("migrateLegacyData error:", error);
  for (const connection of mongoose.connections) {
    try {
      if (connection.readyState !== 0) {
        await connection.close();
      }
    } catch {}
  }
  process.exit(1);
});

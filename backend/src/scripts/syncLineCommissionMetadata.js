require("dotenv").config();
const mongoose = require("mongoose");
const CustomObject = require("../models/CustomObject");

const commissionAppliesField = {
  label: "Genera comision",
  apiName: "commission_applies",
  type: "boolean",
  required: false,
  defaultValue: true,
  visibleInList: true,
  visibleInDetail: true,
  visibleInForm: true,
};

const commissionQuantityField = {
  label: "Unidades comisionables",
  apiName: "commission_quantity",
  type: "formula",
  visibleInList: false,
  visibleInDetail: true,
  visibleInForm: false,
  formula: {
    expression: "IF(commission_applies, quantity, 0)",
    returnType: "number",
  },
};

async function patchLineObject(apiName) {
  const definition = await CustomObject.findOne({ apiName });
  if (!definition) throw new Error(`Objeto no encontrado: ${apiName}`);
  const fields = (definition.fields || []).filter(
    (field) => !["commission_applies", "commission_quantity"].includes(field.apiName)
  );
  const quantityIndex = fields.findIndex((field) => field.apiName === "quantity");
  fields.splice(quantityIndex + 1, 0, commissionAppliesField, commissionQuantityField);
  definition.fields = fields;
  definition.markModified("fields");
  await definition.save();
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
    serverSelectionTimeoutMS: 15000,
  });
  await patchLineObject("quote_item");
  await patchLineObject("sale_item");

  const salesDefinition = await CustomObject.findOne({ apiName: "sales" });
  const commissionRollup = (salesDefinition.fields || []).find(
    (field) => field.apiName === "commission_units"
  );
  commissionRollup.rollup.fieldToAggregate = "commission_quantity";
  salesDefinition.markModified("fields");
  await salesDefinition.save();

  const db = mongoose.connection.useDb(process.env.MIGRATION_TARGET_DB || "test", { useCache: true });
  const [quoteResult, saleResult] = await Promise.all([
    db.collection("quote_item").updateMany(
      { commission_applies: { $exists: false } },
      { $set: { commission_applies: true } }
    ),
    db.collection("sale_item").updateMany(
      { commission_applies: { $exists: false } },
      { $set: { commission_applies: true } }
    ),
  ]);
  const [quoteItems, saleItems] = await Promise.all([
    db.collection("quote_item").find({}).project({ quantity: 1, commission_applies: 1 }).toArray(),
    db.collection("sale_item").find({}).project({ quantity: 1, commission_applies: 1 }).toArray(),
  ]);
  if (quoteItems.length) {
    await db.collection("quote_item").bulkWrite(quoteItems.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { commission_quantity: item.commission_applies === false ? 0 : Number(item.quantity) || 0 } },
      },
    })));
  }
  if (saleItems.length) {
    await db.collection("sale_item").bulkWrite(saleItems.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { commission_quantity: item.commission_applies === false ? 0 : Number(item.quantity) || 0 } },
      },
    })));
  }

  const [sales, completedItems] = await Promise.all([
    db.collection("sales").find({}).project({ _id: 1, status: 1 }).toArray(),
    db.collection("sale_item")
      .find({ sale_status: "Completada" })
      .project({ sale: 1, commission_quantity: 1 })
      .toArray(),
  ]);
  const unitsBySale = completedItems.reduce((map, item) => {
    const saleId = String(item.sale || "");
    map.set(saleId, (map.get(saleId) || 0) + (Number(item.commission_quantity) || 0));
    return map;
  }, new Map());
  if (sales.length) {
    await db.collection("sales").bulkWrite(sales.map((sale) => {
      const units = sale.status === "Completada" ? unitsBySale.get(String(sale._id)) || 0 : 0;
      return {
        updateOne: {
          filter: { _id: sale._id },
          update: { $set: { commission_units: units, commission_amount: units * 5000 } },
        },
      };
    }));
  }

  console.log(JSON.stringify({
    quoteItemsBackfilled: quoteResult.modifiedCount,
    saleItemsBackfilled: saleResult.modifiedCount,
    salesRecalculated: sales.length,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

require("dotenv").config();
const mongoose = require("mongoose");
const CustomObject = require("../models/CustomObject");

function field(apiName, label, type, extra = {}) {
  return {
    apiName,
    label,
    type,
    required: false,
    visibleInList: apiName !== "prize_reference",
    visibleInDetail: true,
    visibleInForm: type !== "formula" && type !== "rollup",
    ...extra,
  };
}

async function syncObject(apiName, childObject, childLookup) {
  const definition = await CustomObject.findOne({ apiName });
  if (!definition) throw new Error(`Objeto no encontrado: ${apiName}`);

  const fields = (definition.fields || []).filter(
    (item) => !["gross_total", "prize_credit", "prize_reference"].includes(item.apiName)
  );
  const totalIndex = fields.findIndex((item) => item.apiName === "total");
  if (totalIndex < 0) throw new Error(`Campo total no encontrado en ${apiName}`);
  fields.splice(
    totalIndex,
    1,
    field("gross_total", "Total antes del premio", "rollup", {
      rollup: {
        relatedObject: childObject,
        relatedField: childLookup,
        operation: "sum",
        fieldToAggregate: "total",
        filterField: "",
        filterOperator: "eq",
        filterValue: "",
      },
    }),
    field("prize_credit", "Credito de premio", "number", { defaultValue: 0 }),
    field("prize_reference", "Referencia del premio", "text"),
    field("total", "Total", "formula", {
      formula: {
        expression: "IF(gross_total - prize_credit > 0, gross_total - prize_credit, 0)",
        returnType: "number",
      },
    })
  );

  for (const layout of definition.layout || []) {
    for (const section of layout.sections || []) {
      if (section.type !== "fields" || !section.fields?.includes("total")) continue;
      section.fields = section.fields.filter(
        (name) => !["gross_total", "prize_credit", "prize_reference"].includes(name)
      );
      const index = section.fields.indexOf("total");
      section.fields.splice(index, 0, "gross_total", "prize_credit", "prize_reference");
    }
  }

  definition.fields = fields;
  definition.markModified("fields");
  definition.markModified("layout");
  await definition.save();

  const db = mongoose.connection.useDb(process.env.MIGRATION_TARGET_DB || "test", { useCache: true });
  const collection = db.collection(apiName);
  const records = await collection.find({}).project({ total: 1, prize_credit: 1 }).toArray();
  if (records.length) {
    await collection.bulkWrite(records.map((record) => ({
      updateOne: {
        filter: { _id: record._id },
        update: {
          $set: {
            gross_total: Number(record.total) || 0,
            prize_credit: Math.max(Number(record.prize_credit) || 0, 0),
          },
        },
      },
    })));
  }
  return records.length;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
    serverSelectionTimeoutMS: 15000,
  });
  const sales = await syncObject("sales", "sale_item", "sale");
  const quotes = await syncObject("quote", "quote_item", "quote");
  console.log(JSON.stringify({ sales, quotes }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

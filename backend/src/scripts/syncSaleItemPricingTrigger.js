const mongoose = require("mongoose");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env");
require("dotenv").config({ path: envPath });

const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");

const pricingAction = {
  type: "setSaleItemPrice",
  config: {
    productLookupField: "product",
    saleLookupField: "sale",
    cashPriceSourceField: "price",
    targetField: "price",
    saleTypeField: "type",
    creditSurcharge: 5000,
  },
};

function buildTrigger(name, when) {
  return {
    name,
    isActive: true,
    when,
    runOrder: 0,
    stopOnError: true,
    conditions: {
      operator: "AND",
      conditions: [
        { field: "product", operator: "isNotEmpty", value: "" },
        { field: "sale", operator: "isNotEmpty", value: "" },
      ],
    },
    actions: [pricingAction],
  };
}

async function main() {
  await connectDB();

  const objectDefinition = await CustomObject.findOne({ apiName: "sale_item" });

  if (!objectDefinition) {
    throw new Error("No se encontro el objeto sale_item");
  }

  const triggerNames = new Set([
    "Colocar precio al crear",
    "Colocar precio al editar",
  ]);

  const remainingTriggers = (objectDefinition.automationTriggers || []).filter(
    (trigger) => !triggerNames.has(trigger.name)
  );

  objectDefinition.automationTriggers = [
    ...remainingTriggers,
    buildTrigger("Colocar precio al crear", "beforeInsert"),
    buildTrigger("Colocar precio al editar", "beforeUpdate"),
  ];

  await objectDefinition.save();

  console.log("Triggers de sale_item sincronizados");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

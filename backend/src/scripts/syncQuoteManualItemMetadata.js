const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");

const MANUAL_PRODUCT_FIELD = {
  label: "Producto manual",
  apiName: "manual_product_name",
  type: "text",
  required: false,
  defaultValue: "",
  visibleInList: true,
  visibleInDetail: true,
  visibleInForm: true,
};

const PENDING_CATALOG_FIELD = {
  label: "Pendiente de catalogo",
  apiName: "pending_catalog_completion",
  type: "boolean",
  required: false,
  defaultValue: false,
  visibleInList: true,
  visibleInDetail: true,
  visibleInForm: true,
};

function ensureField(objectDefinition, fieldDefinition, insertAfterApiName) {
  const fields = objectDefinition.fields || [];
  const existingIndex = fields.findIndex((field) => field.apiName === fieldDefinition.apiName);

  if (existingIndex >= 0) {
    fields[existingIndex] = {
      ...fields[existingIndex].toObject?.(),
      ...fieldDefinition,
    };
    return;
  }

  const insertAfterIndex = fields.findIndex((field) => field.apiName === insertAfterApiName);
  const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : fields.length;
  fields.splice(insertIndex, 0, fieldDefinition);
}

async function run() {
  await connectDB();

  const objectDefinition = await CustomObject.findOne({ apiName: "quote_item" });
  if (!objectDefinition) {
    throw new Error('No existe el objeto "quote_item"');
  }

  const productIndex = (objectDefinition.fields || []).findIndex(
    (field) => field.apiName === "product"
  );
  if (productIndex >= 0) {
    objectDefinition.fields[productIndex] = {
      ...objectDefinition.fields[productIndex].toObject?.(),
      required: false,
    };
  }

  ensureField(objectDefinition, MANUAL_PRODUCT_FIELD, "product");
  ensureField(objectDefinition, PENDING_CATALOG_FIELD, "manual_product_name");

  objectDefinition.layout = (objectDefinition.layout || []).map((layout) => ({
    ...layout.toObject?.(),
    sections: (layout.sections || []).map((section) => {
      const nextSection = { ...section.toObject?.() };
      if (!Array.isArray(nextSection.fields)) return nextSection;

      if (
        nextSection.fields.includes("product") &&
        !nextSection.fields.includes("manual_product_name")
      ) {
        const productFieldIndex = nextSection.fields.indexOf("product");
        nextSection.fields.splice(productFieldIndex + 1, 0, "manual_product_name");
      }

      if (
        nextSection.fields.includes("manual_product_name") &&
        !nextSection.fields.includes("pending_catalog_completion")
      ) {
        const manualFieldIndex = nextSection.fields.indexOf("manual_product_name");
        nextSection.fields.splice(manualFieldIndex + 1, 0, "pending_catalog_completion");
      }

      return nextSection;
    }),
  }));

  objectDefinition.listViews = (objectDefinition.listViews || []).map((view) => {
    const nextView = { ...view.toObject?.() };
    const columns = Array.isArray(nextView.columns) ? [...nextView.columns] : [];

    if (columns.includes("product") && !columns.includes("manual_product_name")) {
      columns.splice(columns.indexOf("product") + 1, 0, "manual_product_name");
    }

    if (
      columns.includes("manual_product_name") &&
      !columns.includes("pending_catalog_completion")
    ) {
      columns.splice(columns.indexOf("manual_product_name") + 1, 0, "pending_catalog_completion");
    }

    nextView.columns = columns;
    return nextView;
  });

  await objectDefinition.save();

  console.log(
    JSON.stringify(
      {
        synced: {
          apiName: objectDefinition.apiName,
          fields: objectDefinition.fields.map((field) => field.apiName),
        },
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error("syncQuoteManualItemMetadata error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");

const DISCOUNT_SCOPE_FIELD = {
  label: "Aplica descuento a",
  apiName: "discount_scope",
  type: "select",
  required: false,
  options: ["Sin descuento", "Ambos", "Solo contado", "Solo credito"],
  defaultValue: "Sin descuento",
  visibleInList: true,
  visibleInDetail: true,
  visibleInForm: true,
};

const DISCOUNT_REASON_FIELD = {
  label: "Motivo del descuento",
  apiName: "discount_reason",
  type: "text",
  required: false,
  defaultValue: "",
  visibleInList: true,
  visibleInDetail: true,
  visibleInForm: true,
};

async function run() {
  await connectDB();

  const objectDefinition = await CustomObject.findOne({ apiName: "quote_item" });

  if (!objectDefinition) {
    throw new Error('No existe el objeto "quote_item"');
  }

  const existingFieldIndex = (objectDefinition.fields || []).findIndex(
    (field) => field.apiName === "discount_scope"
  );

  if (existingFieldIndex >= 0) {
    objectDefinition.fields[existingFieldIndex] = {
      ...objectDefinition.fields[existingFieldIndex].toObject?.(),
      ...DISCOUNT_SCOPE_FIELD,
    };
  } else {
    const discountIndex = (objectDefinition.fields || []).findIndex(
      (field) => field.apiName === "discount"
    );
    const insertIndex = discountIndex >= 0 ? discountIndex + 1 : objectDefinition.fields.length;
    objectDefinition.fields.splice(insertIndex, 0, DISCOUNT_SCOPE_FIELD);
  }

  const existingReasonFieldIndex = (objectDefinition.fields || []).findIndex(
    (field) => field.apiName === "discount_reason"
  );

  if (existingReasonFieldIndex >= 0) {
    objectDefinition.fields[existingReasonFieldIndex] = {
      ...objectDefinition.fields[existingReasonFieldIndex].toObject?.(),
      ...DISCOUNT_REASON_FIELD,
    };
  } else {
    const scopeIndex = (objectDefinition.fields || []).findIndex(
      (field) => field.apiName === "discount_scope"
    );
    const insertIndex = scopeIndex >= 0 ? scopeIndex + 1 : objectDefinition.fields.length;
    objectDefinition.fields.splice(insertIndex, 0, DISCOUNT_REASON_FIELD);
  }

  objectDefinition.layout = (objectDefinition.layout || []).map((layout) => ({
    ...layout.toObject?.(),
    sections: (layout.sections || []).map((section) => {
      const nextSection = { ...section.toObject?.() };
      if (!Array.isArray(nextSection.fields)) {
        return nextSection;
      }

      if (
        nextSection.fields.includes("discount") &&
        !nextSection.fields.includes("discount_scope")
      ) {
        const discountFieldIndex = nextSection.fields.indexOf("discount");
        nextSection.fields.splice(discountFieldIndex + 1, 0, "discount_scope");
      }

      if (
        nextSection.fields.includes("discount_scope") &&
        !nextSection.fields.includes("discount_reason")
      ) {
        const scopeFieldIndex = nextSection.fields.indexOf("discount_scope");
        nextSection.fields.splice(scopeFieldIndex + 1, 0, "discount_reason");
      }

      return nextSection;
    }),
  }));

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
    console.error("syncQuoteDiscountScopeMetadata error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");

const SUPPLIER_FIELDS = [
  {
    label: "Proveedor asociado",
    apiName: "supplier_match_name",
    type: "text",
    required: false,
    defaultValue: "",
    visibleInList: false,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Tipo de match proveedor",
    apiName: "supplier_match_type",
    type: "text",
    required: false,
    defaultValue: "",
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Mayorista proveedor",
    apiName: "supplier_last_wholesale_price",
    type: "number",
    required: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Texto mayorista proveedor",
    apiName: "supplier_price_raw",
    type: "text",
    required: false,
    defaultValue: "",
    visibleInList: false,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Proveedor en oferta",
    apiName: "supplier_is_offer",
    type: "boolean",
    required: false,
    defaultValue: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Ultima sync proveedor",
    apiName: "supplier_last_sync_at",
    type: "date",
    required: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Mayorista proveedor anterior",
    apiName: "supplier_previous_wholesale_price",
    type: "number",
    required: false,
    visibleInList: false,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Cambio mayorista",
    apiName: "supplier_wholesale_delta",
    type: "number",
    required: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Cambio mayorista %",
    apiName: "supplier_wholesale_delta_pct",
    type: "number",
    required: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Alerta cambio proveedor",
    apiName: "supplier_change_alert",
    type: "boolean",
    required: false,
    defaultValue: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Precio contado minimo sugerido",
    apiName: "suggested_min_cash_price",
    type: "number",
    required: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
  {
    label: "Alerta riesgo contado",
    apiName: "cash_price_risk_alert",
    type: "boolean",
    required: false,
    defaultValue: false,
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  },
];

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

  const objectDefinition = await CustomObject.findOne({ apiName: "product" });
  if (!objectDefinition) {
    throw new Error('No existe el objeto "product"');
  }

  let anchor = "aliases";
  for (const field of SUPPLIER_FIELDS) {
    ensureField(objectDefinition, field, anchor);
    anchor = field.apiName;
  }

  objectDefinition.layout = (objectDefinition.layout || []).map((layout) => ({
    ...layout.toObject?.(),
    sections: (layout.sections || []).map((section) => {
      const nextSection = { ...section.toObject?.() };
      if (!Array.isArray(nextSection.fields)) return nextSection;

      if (String(nextSection.label || "").trim().toLowerCase() === "detalles") {
        const insertAfter = "aliases";
        const insertAfterIndex = nextSection.fields.indexOf(insertAfter);
        let insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextSection.fields.length;

        for (const field of SUPPLIER_FIELDS) {
          if (!nextSection.fields.includes(field.apiName)) {
            nextSection.fields.splice(insertIndex, 0, field.apiName);
            insertIndex += 1;
          }
        }
      }

      return nextSection;
    }),
  }));

  objectDefinition.listViews = (objectDefinition.listViews || []).map((view) => {
    const nextView = { ...view.toObject?.() };
    const columns = Array.isArray(nextView.columns) ? [...nextView.columns] : [];

    const desired = [
      "supplier_last_wholesale_price",
      "suggested_min_cash_price",
      "supplier_wholesale_delta_pct",
      "supplier_change_alert",
      "cash_price_risk_alert",
      "supplier_is_offer",
      "supplier_last_sync_at",
    ];

    const insertAfterIndex = columns.includes("price")
      ? columns.indexOf("price") + 1
      : columns.length;

    let offset = 0;
    for (const fieldApiName of desired) {
      if (!columns.includes(fieldApiName)) {
        columns.splice(insertAfterIndex + offset, 0, fieldApiName);
        offset += 1;
      }
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
    console.error("syncSupplierReferenceMetadata error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

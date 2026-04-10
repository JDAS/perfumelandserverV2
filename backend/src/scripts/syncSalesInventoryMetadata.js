const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");

function ensureField(fields, nextField) {
  const existingIndex = fields.findIndex((field) => field.apiName === nextField.apiName);

  if (existingIndex >= 0) {
    fields[existingIndex] = {
      ...fields[existingIndex],
      ...nextField,
    };
    return fields;
  }

  return [...fields, nextField];
}

async function syncProductObject() {
  const objectDefinition = await CustomObject.findOne({ apiName: "product" });
  if (!objectDefinition) return;

  let nextFields = (objectDefinition.fields || []).map((field) => field.toObject?.() || field);

  nextFields = ensureField(nextFields, {
    label: "Controlar inventario",
    apiName: "track_inventory",
    type: "boolean",
    required: false,
    options: [],
    defaultValue: false,
    referenceTo: "",
    lookupFilters: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
    formula: { expression: "", returnType: "boolean" },
    rollup: {
      relatedObject: "",
      relatedField: "",
      operation: "count",
      fieldToAggregate: "",
      filterField: "",
      filterOperator: "eq",
      filterValue: null,
    },
  });

  nextFields = nextFields.map((field) => {
    if (field.apiName === "sold") {
      return {
        ...field,
        rollup: {
          ...(field.rollup || {}),
          relatedObject: "sale_item",
          relatedField: "product",
          operation: "sum",
          fieldToAggregate: "quantity",
          filterField: "sale_status",
          filterOperator: "eq",
          filterValue: "Completada",
        },
      };
    }

    if (field.apiName === "available") {
      return {
        ...field,
        formula: {
          expression: "IF(track_inventory, purchaseditems - sold, 0)",
          returnType: "number",
        },
      };
    }

    return field;
  });

  objectDefinition.fields = nextFields;

  if (Array.isArray(objectDefinition.listViews)) {
    objectDefinition.listViews = objectDefinition.listViews.map((view) => {
      const nextView = view.toObject?.() || view;
      if (!Array.isArray(nextView.columns)) return nextView;

      if (!nextView.columns.includes("track_inventory")) {
        const insertAt = nextView.columns.includes("featured")
          ? nextView.columns.indexOf("featured") + 1
          : nextView.columns.length;
        nextView.columns.splice(insertAt, 0, "track_inventory");
      }

      return nextView;
    });
  }

  if (Array.isArray(objectDefinition.layout)) {
    objectDefinition.layout = objectDefinition.layout.map((layout) => {
      const nextLayout = layout.toObject?.() || layout;
      if (!Array.isArray(nextLayout.sections)) return nextLayout;

      nextLayout.sections = nextLayout.sections.map((section) => {
        const nextSection = section.toObject?.() || section;
        if (nextSection.type !== "fields" || !Array.isArray(nextSection.fields)) {
          return nextSection;
        }

        if (!nextSection.fields.includes("track_inventory")) {
          const insertAt = nextSection.fields.includes("sort_order")
            ? nextSection.fields.indexOf("sort_order") + 1
            : nextSection.fields.length;
          nextSection.fields.splice(insertAt, 0, "track_inventory");
        }

        return nextSection;
      });

      return nextLayout;
    });
  }

  await objectDefinition.save();
}

async function syncSaleItemObject() {
  const objectDefinition = await CustomObject.findOne({ apiName: "sale_item" });
  if (!objectDefinition) return;

  let nextFields = (objectDefinition.fields || []).map((field) => field.toObject?.() || field);

  nextFields = ensureField(nextFields, {
    label: "Precio lista",
    apiName: "list_price",
    type: "number",
    required: false,
    options: [],
    defaultValue: "",
    referenceTo: "",
    lookupFilters: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: false,
    formula: { expression: "", returnType: "number" },
    rollup: {
      relatedObject: "",
      relatedField: "",
      operation: "count",
      fieldToAggregate: "",
      filterField: "",
      filterOperator: "eq",
      filterValue: null,
    },
  });

  nextFields = ensureField(nextFields, {
    label: "Costo snapshot",
    apiName: "cost_snapshot",
    type: "number",
    required: false,
    options: [],
    defaultValue: "",
    referenceTo: "",
    lookupFilters: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: false,
    formula: { expression: "", returnType: "number" },
    rollup: {
      relatedObject: "",
      relatedField: "",
      operation: "count",
      fieldToAggregate: "",
      filterField: "",
      filterOperator: "eq",
      filterValue: null,
    },
  });

  objectDefinition.fields = ensureField(
    nextFields,
    {
      label: "Estado de venta",
      apiName: "sale_status",
      type: "text",
      required: false,
      options: [],
      defaultValue: "",
      referenceTo: "",
      lookupFilters: [],
      visibleInList: true,
      visibleInDetail: true,
      visibleInForm: false,
      formula: { expression: "", returnType: "text" },
      rollup: {
        relatedObject: "",
        relatedField: "",
        operation: "count",
        fieldToAggregate: "",
        filterField: "",
        filterOperator: "eq",
        filterValue: null,
      },
    }
  );

  objectDefinition.fields = objectDefinition.fields.map((field) => {
    const nextField = field.toObject?.() || field;
    if (nextField.apiName !== "product") return nextField;
    return {
      ...nextField,
      lookupFilters: [],
    };
  });

  if (Array.isArray(objectDefinition.listViews)) {
    objectDefinition.listViews = objectDefinition.listViews.map((view) => {
      const nextView = view.toObject?.() || view;
      if (nextView.apiName !== "all") return nextView;

      const baseColumns = Array.isArray(nextView.columns) ? nextView.columns : [];
      nextView.columns = [
        "sale",
        "sale_status",
        ...baseColumns.filter(
          (item) => !["sale", "sale_status"].includes(item)
        ),
      ];

      if (!nextView.columns.includes("list_price")) {
        nextView.columns.push("list_price");
      }
      if (!nextView.columns.includes("cost_snapshot")) {
        nextView.columns.push("cost_snapshot");
      }
      return nextView;
    });
  }

  if (Array.isArray(objectDefinition.layout)) {
    objectDefinition.layout = objectDefinition.layout.map((layout) => {
      const nextLayout = layout.toObject?.() || layout;
      if (!Array.isArray(nextLayout.sections)) return nextLayout;

      nextLayout.sections = nextLayout.sections.map((section) => {
        const nextSection = section.toObject?.() || section;
        if (nextSection.type !== "fields") return nextSection;
        if (!Array.isArray(nextSection.fields)) return nextSection;

        ["list_price", "cost_snapshot", "sale_status"].forEach((apiName) => {
          if (!nextSection.fields.includes(apiName)) {
            nextSection.fields = [...nextSection.fields, apiName];
          }
        });

        return nextSection;
      });

      return nextLayout;
    });
  }

  const pricingConfig = {
    productLookupField: "product",
    saleLookupField: "sale",
    cashPriceSourceField: "price",
    targetField: "price",
    listPriceTargetField: "list_price",
    costTargetField: "cost_snapshot",
    saleTypeField: "type",
    creditSurcharge: 5000,
  };

  const statusCopyAction = {
    type: "copyFromLookup",
    config: {
      sourcePath: "sale.status",
      targetField: "sale_status",
    },
  };

  objectDefinition.automationTriggers = [
    {
      name: "Colocar precio al crear",
      isActive: true,
      when: "beforeInsert",
      runOrder: 0,
      stopOnError: true,
      conditions: {
        operator: "AND",
        conditions: [
          { field: "product", operator: "isNotEmpty", value: "" },
          { field: "sale", operator: "isNotEmpty", value: "" },
        ],
      },
      actions: [
        statusCopyAction,
        { type: "setSaleItemPrice", config: pricingConfig },
      ],
    },
    {
      name: "Colocar precio al editar",
      isActive: true,
      when: "beforeUpdate",
      runOrder: 0,
      stopOnError: true,
      conditions: {
        operator: "AND",
        conditions: [
          { field: "product", operator: "isNotEmpty", value: "" },
          { field: "sale", operator: "isNotEmpty", value: "" },
        ],
      },
      actions: [
        statusCopyAction,
        { type: "setSaleItemPrice", config: pricingConfig },
      ],
    },
  ];

  await objectDefinition.save();
}

async function syncSalesObject() {
  const objectDefinition = await CustomObject.findOne({ apiName: "sales" });
  if (!objectDefinition) return;

  let nextFields = (objectDefinition.fields || []).map((field) => field.toObject?.() || field);

  nextFields = ensureField(nextFields, {
    label: "Total pagado",
    apiName: "total_paid",
    type: "rollup",
    required: false,
    options: [],
    defaultValue: "",
    referenceTo: "",
    lookupFilters: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: false,
    formula: { expression: "", returnType: "text" },
    rollup: {
      relatedObject: "payment",
      relatedField: "sale_id",
      operation: "sum",
      fieldToAggregate: "amount",
      filterField: "",
      filterOperator: "eq",
      filterValue: "",
    },
  });

  nextFields = ensureField(nextFields, {
    label: "Saldo pendiente",
    apiName: "balance_due",
    type: "formula",
    required: false,
    options: [],
    defaultValue: "",
    referenceTo: "",
    lookupFilters: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: false,
    formula: { expression: "total - total_paid", returnType: "number" },
    rollup: {
      relatedObject: "",
      relatedField: "",
      operation: "count",
      fieldToAggregate: "",
      filterField: "",
      filterOperator: "eq",
      filterValue: null,
    },
  });

  nextFields = ensureField(nextFields, {
    label: "Estado de pago",
    apiName: "payment_status",
    type: "select",
    required: false,
    options: ["Borrador", "Pendiente", "Parcial", "Pagada", "Cancelada"],
    defaultValue: "Borrador",
    referenceTo: "",
    lookupFilters: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: false,
    formula: { expression: "", returnType: "text" },
    rollup: {
      relatedObject: "",
      relatedField: "",
      operation: "count",
      fieldToAggregate: "",
      filterField: "",
      filterOperator: "eq",
      filterValue: null,
    },
  });

  objectDefinition.fields = nextFields;

  if (Array.isArray(objectDefinition.listViews)) {
    objectDefinition.listViews = objectDefinition.listViews.map((view) => {
      const nextView = view.toObject?.() || view;
      if (!Array.isArray(nextView.columns)) return nextView;

      ["payment_status", "balance_due"].forEach((apiName) => {
        if (!nextView.columns.includes(apiName)) {
          nextView.columns.push(apiName);
        }
      });

      return nextView;
    });
  }

  if (Array.isArray(objectDefinition.layout)) {
    objectDefinition.layout = objectDefinition.layout.map((layout) => {
      const nextLayout = layout.toObject?.() || layout;
      if (!Array.isArray(nextLayout.sections)) return nextLayout;

      nextLayout.sections = nextLayout.sections.map((section) => {
        const nextSection = section.toObject?.() || section;
        if (nextSection.type !== "fields" || !Array.isArray(nextSection.fields)) {
          return nextSection;
        }

        ["total_paid", "balance_due", "payment_status"].forEach((apiName) => {
          if (!nextSection.fields.includes(apiName)) {
            nextSection.fields.push(apiName);
          }
        });

        return nextSection;
      });

      return nextLayout;
    });
  }

  const newTrigger = {
    name: "Sincronizar estado de lineas de venta",
    isActive: true,
    when: "afterUpdate",
    runOrder: 5,
    stopOnError: true,
    conditions: {
      operator: "AND",
      conditions: [{ field: "status", operator: "changed", value: "" }],
    },
    actions: [
      {
        type: "syncSaleItemStatus",
        config: {
          saleStatusField: "status",
          targetObject: "sale_item",
          saleLookupField: "sale",
          targetStatusField: "sale_status",
          completedStatus: "Completada",
          productLookupField: "product",
          productObject: "product",
          soldField: "sold",
        },
      },
    ],
  };

  const paymentStatusTrigger = {
    name: "Actualizar estado de pago",
    isActive: true,
    when: "afterUpdate",
    runOrder: 6,
    stopOnError: true,
    conditions: {
      operator: "OR",
      conditions: [
        { field: "status", operator: "changed", value: "" },
        { field: "total", operator: "changed", value: "" },
        { field: "total_paid", operator: "changed", value: "" },
      ],
    },
    actions: [
      {
        type: "setSalePaymentStatus",
        config: {
          statusField: "status",
          totalField: "total",
          totalPaidField: "total_paid",
          targetField: "payment_status",
        },
      },
    ],
  };

  const triggers = (objectDefinition.automationTriggers || [])
    .map((trigger) => trigger.toObject?.() || trigger)
    .filter(
      (trigger) =>
        trigger.name !== newTrigger.name &&
        trigger.name !== paymentStatusTrigger.name
    );

  objectDefinition.automationTriggers = [...triggers, newTrigger, paymentStatusTrigger];
  await objectDefinition.save();
}

async function main() {
  await connectDB();
  await syncProductObject();
  await syncSaleItemObject();
  await syncSalesObject();
  console.log("Metadata de inventario y ventas sincronizada");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

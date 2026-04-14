const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");
const { getSuiteById } = require("../data/suites");

function mergeFieldList(existingFields = [], incomingFields = []) {
  const nextFields = [...existingFields];
  incomingFields.forEach((fieldApiName) => {
    if (!nextFields.includes(fieldApiName)) {
      nextFields.push(fieldApiName);
    }
  });
  return nextFields;
}

function mergeFieldDefinitions(existingFields = [], incomingFields = []) {
  const fieldMap = new Map(existingFields.map((field) => [field.apiName, field]));

  incomingFields.forEach((field) => {
    if (fieldMap.has(field.apiName)) {
      fieldMap.set(field.apiName, { ...fieldMap.get(field.apiName), ...field });
    } else {
      fieldMap.set(field.apiName, field);
    }
  });

  return Array.from(fieldMap.values());
}

function upsertView(views = [], incomingView) {
  const index = views.findIndex((view) => view.apiName === incomingView.apiName);
  if (index === -1) return [...views, incomingView];

  const existingView = views[index];
  const nextViews = [...views];
  nextViews[index] = {
    ...existingView,
    ...incomingView,
    columns: mergeFieldList(existingView.columns || [], incomingView.columns || []),
  };
  return nextViews;
}

function patchSalesObject(existing, source) {
  const next = existing.toObject();
  const incomingFields = source.fields.filter((field) =>
    [
      "commission_units",
      "commission_amount",
      "commission_paid",
      "commission_paid_date",
    ].includes(field.apiName)
  );

  next.fields = mergeFieldDefinitions(existing.fields || [], incomingFields);

  const defaultLayout = (next.layout || [])[0];
  const sourceLayout = (source.layout || [])[0];
  const sourceDetails = (sourceLayout?.sections || []).find(
    (section) => section.label === "Detalles"
  );
  const targetDetails = (defaultLayout?.sections || []).find(
    (section) => section.label === "Detalles"
  );

  if (targetDetails && sourceDetails) {
    targetDetails.fields = mergeFieldList(targetDetails.fields || [], [
      "commission_units",
      "commission_amount",
      "commission_paid",
      "commission_paid_date",
    ]);
  }

  const sourceViews = source.listViews || [];
  let nextViews = existing.listViews || [];
  sourceViews
    .filter((view) =>
      ["all", "drafts", "commission_pending", "commission_paid_view"].includes(view.apiName)
    )
    .forEach((view) => {
      nextViews = upsertView(nextViews, view);
    });

  next.listViews = nextViews;
  const incomingTriggers = (source.automationTriggers || []).filter((trigger) =>
    [
      "Colocar fecha si nace completada",
      "Colocar fecha al completar",
      "Colocar fecha al pagar comision al crear",
      "Colocar fecha al pagar comision",
      "Generar plan de pago al crear venta a credito",
      "Regenerar plan de pago al editar venta a credito",
    ].includes(trigger.name)
  );

  const triggerMap = new Map(
    (existing.automationTriggers || []).map((trigger) => [trigger.name, trigger])
  );

  incomingTriggers.forEach((trigger) => {
    triggerMap.set(trigger.name, trigger);
  });

  next.automationTriggers = Array.from(triggerMap.values()).sort(
    (left, right) => Number(left.runOrder || 0) - Number(right.runOrder || 0)
  );

  return next;
}

async function backfillCommissionData() {
  const SalesModel = require("../models/CustomRecord").getCustomRecordModel("sales");
  const SaleItemModel = require("../models/CustomRecord").getCustomRecordModel("sale_item");

  const saleItems = await SaleItemModel.find({ sale_status: "Completada" })
    .select("sale quantity")
    .lean();

  const unitsBySale = saleItems.reduce((map, item) => {
    const saleId = String(item.sale || "");
    if (!saleId) return map;
    map.set(saleId, (map.get(saleId) || 0) + (Number(item.quantity) || 0));
    return map;
  }, new Map());

  const sales = await SalesModel.find({})
    .select("status legacyCommissionPaid commission_paid commission_paid_date")
    .lean();

  let updated = 0;

  for (const sale of sales) {
    const saleId = String(sale._id);
    const commissionUnits = sale.status === "Completada" ? unitsBySale.get(saleId) || 0 : 0;
    const commissionAmount = commissionUnits * 5000;
    const commissionPaid =
      typeof sale.commission_paid === "boolean"
        ? sale.commission_paid
        : Boolean(sale.legacyCommissionPaid);

    const update = {
      commission_units: commissionUnits,
      commission_amount: commissionAmount,
      commission_paid: commissionPaid,
    };

    if (commissionPaid && !sale.commission_paid_date) {
      update.commission_paid_date = null;
    }

    // eslint-disable-next-line no-await-in-loop
    await SalesModel.updateOne({ _id: sale._id }, { $set: update });
    updated += 1;
  }

  return {
    salesReviewed: sales.length,
    salesUpdated: updated,
  };
}

async function run() {
  const suite = getSuiteById("commerce-ops");
  if (!suite) throw new Error("Suite commerce-ops no encontrada");

  const sourceSales = suite.objects.find((objectDefinition) => objectDefinition.apiName === "sales");
  if (!sourceSales) throw new Error("Objeto sales no encontrado en la suite");

  await connectDB();

  const existing = await CustomObject.findOne({ apiName: "sales" });
  if (!existing) throw new Error("Objeto sales no encontrado en metadata");

  const patched = patchSalesObject(existing, sourceSales);
  existing.set(patched);
  await existing.save();

  const backfill = await backfillCommissionData();

  console.log(
    JSON.stringify(
      {
        metadata: { apiName: "sales", action: "updated" },
        backfill,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error("syncSalesCommissionMetadata error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

require("dotenv").config();
const mongoose = require("mongoose");
const CustomObject = require("../models/CustomObject");
const ReportDefinition = require("../models/ReportDefinition");

const fields = [
  { label: "Descripcion", apiName: "name", type: "text", required: true, visibleInList: true, visibleInDetail: true, visibleInForm: true },
  { label: "Fecha", apiName: "date", type: "date", required: true, defaultValue: { mode: "relative", offsetDays: 0 }, visibleInList: true, visibleInDetail: true, visibleInForm: true },
  { label: "Tipo", apiName: "type", type: "select", required: true, options: ["Aporte", "Retiro", "Ajuste entrada", "Ajuste salida"], visibleInList: true, visibleInDetail: true, visibleInForm: true },
  { label: "Monto", apiName: "amount", type: "number", required: true, visibleInList: true, visibleInDetail: true, visibleInForm: true },
  { label: "Estado", apiName: "status", type: "select", required: true, options: ["Borrador", "Confirmado"], defaultValue: "Confirmado", visibleInList: true, visibleInDetail: true, visibleInForm: true },
  { label: "Notas", apiName: "notes", type: "textarea", required: false, visibleInList: false, visibleInDetail: true, visibleInForm: true },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
    serverSelectionTimeoutMS: 15000,
  });
  const object = await CustomObject.findOneAndUpdate(
    { apiName: "cash_movement" },
    { $set: {
      name: "Movimiento de caja",
      pluralLabel: "Movimientos de caja",
      apiName: "cash_movement",
      description: "Aportes, retiros y ajustes que modifican la caja disponible.",
      active: true,
      tabsEnabled: true,
      fields,
      layout: [{ label: "Principal", apiName: "principal", isDefault: true, sections: [{ label: "Detalles", type: "fields", columns: 2, fields: fields.map((field) => field.apiName) }] }],
      listViews: [{ label: "Todos", apiName: "all", isDefault: true, columns: ["date", "name", "type", "amount", "status"], filters: [], sortBy: "date", sortOrder: "desc" }],
      automationTriggers: [],
    } },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();
  const report = await ReportDefinition.findOneAndUpdate(
    { apiName: "cash_available" },
    { $set: {
      name: "Caja disponible",
      apiName: "cash_available",
      description: "Muestra el efectivo disponible para compras a partir de entradas y salidas reales.",
      engine: "cash_available",
      sourceObject: "cash_movement",
      isActive: true,
      filters: [], groupBy: [], metrics: [], columns: [], sort: [],
    } },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();
  console.log(JSON.stringify({ object: { id: object._id, apiName: object.apiName }, report: { id: report._id, apiName: report.apiName } }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

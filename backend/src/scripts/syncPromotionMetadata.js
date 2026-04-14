const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");
const {
  sanitizeObjectPayload,
  validateObjectMetadata,
} = require("../utils/objectMetadata");
const { getSuiteById } = require("../data/suites");

const PROMOTION_OBJECTS = [
  "campaign",
  "campaign_participant",
  "campaign_entry",
  "campaign_sale_link",
];

async function upsertObjectDefinition(payload) {
  const sanitized = sanitizeObjectPayload(payload);
  const errors = validateObjectMetadata(sanitized);

  if (errors.length > 0) {
    throw new Error(`Error en ${sanitized.apiName}: ${errors.join(" | ")}`);
  }

  const existing = await CustomObject.findOne({ apiName: sanitized.apiName });

  if (existing) {
    existing.set(sanitized);
    await existing.save();
    return { apiName: sanitized.apiName, action: "updated" };
  }

  await CustomObject.create(sanitized);
  return { apiName: sanitized.apiName, action: "created" };
}

async function run() {
  const suite = getSuiteById("commerce-ops");
  if (!suite) throw new Error("Suite commerce-ops no encontrada");

  await connectDB();

  const targetObjects = suite.objects.filter((objectDefinition) =>
    PROMOTION_OBJECTS.includes(objectDefinition.apiName)
  );

  const results = [];
  for (const objectDefinition of targetObjects) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await upsertObjectDefinition(objectDefinition));
  }

  console.log(JSON.stringify({ synced: results }, null, 2));
}

run()
  .catch((error) => {
    console.error("syncPromotionMetadata error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

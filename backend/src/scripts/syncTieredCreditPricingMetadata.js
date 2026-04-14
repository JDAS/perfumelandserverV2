const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CustomObject = require("../models/CustomObject");

const TARGET_OBJECTS = ["sale_item", "quote_item"];

function patchPricingConfig(config = {}) {
  return {
    ...config,
    creditSurcharge: Number(config.creditSurcharge) || 5000,
    creditSurchargeLower:
      config.creditSurchargeLower !== undefined
        ? Number(config.creditSurchargeLower) || 3000
        : 3000,
    creditSurchargeThreshold:
      config.creditSurchargeThreshold !== undefined
        ? Number(config.creditSurchargeThreshold) || 25000
        : 25000,
  };
}

async function run() {
  await connectDB();

  const objects = await CustomObject.find({ apiName: { $in: TARGET_OBJECTS } });
  const results = [];

  for (const objectDefinition of objects) {
    let touched = false;

    objectDefinition.automationTriggers = (objectDefinition.automationTriggers || []).map(
      (trigger) => {
        const nextActions = (trigger.actions || []).map((action) => {
          if (action?.type !== "setSaleItemPrice") return action;
          touched = true;
          return {
            ...action,
            config: patchPricingConfig(action.config || {}),
          };
        });

        return {
          ...trigger,
          actions: nextActions,
        };
      }
    );

    if (touched) {
      await objectDefinition.save();
      results.push({ apiName: objectDefinition.apiName, action: "updated" });
    } else {
      results.push({ apiName: objectDefinition.apiName, action: "unchanged" });
    }
  }

  console.log(JSON.stringify({ synced: results }, null, 2));
}

run()
  .catch((error) => {
    console.error("syncTieredCreditPricingMetadata error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

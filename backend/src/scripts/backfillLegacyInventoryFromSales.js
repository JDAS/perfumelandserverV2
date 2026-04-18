const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const {
  seedLegacyInventoryFromSales,
  syncInventoryForProductsOnConnection,
} = require("../services/legacyInventorySeedService");

const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no esta configurado.");
  }

  const dryRun = !process.argv.includes("--write");
  const connection = await mongoose
    .createConnection(process.env.MONGO_URI, {
      dbName: TARGET_DB_NAME,
    })
    .asPromise();

  try {
    const seedResult = await seedLegacyInventoryFromSales({
      connection,
      dryRun,
    });

    const syncResult = await syncInventoryForProductsOnConnection({
      connection,
      productIds: seedResult.touchedProductIds,
      dryRun,
    });

    console.log(
      JSON.stringify(
        {
          dryRun,
          targetDb: TARGET_DB_NAME,
          seedResult: {
            ...seedResult,
            touchedProductIds: seedResult.touchedProductIds.length,
          },
          syncResult,
        },
        null,
        2
      )
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

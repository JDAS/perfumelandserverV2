try {
  require("dotenv").config();
} catch (error) {
  // Allow execution when env vars are already provided.
}

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { getCustomRecordModel } = require("../models/CustomRecord");

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI no esta definida. Configura backend/.env o exporta la variable antes de correr el script."
    );
  }

  await connectDB();

  const ProductRecord = getCustomRecordModel("product");
  const result = await ProductRecord.updateMany(
    {
      $or: [{ catalog_status: { $exists: false } }, { catalog_status: null }, { catalog_status: "" }],
    },
    {
      $set: {
        catalog_status: "Listo para catalogo",
      },
    }
  );

  console.log(`Productos actualizados con estado de catalogo: ${result.modifiedCount}`);
}

run()
  .catch((error) => {
    console.error("Error haciendo backfill de catalog_status:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

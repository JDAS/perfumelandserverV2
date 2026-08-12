require("dotenv").config();
const mongoose = require("mongoose");

const physicalStock = new Map([
  ["Club de Nuit Intense", 2],
  ["Splah Victoria's Secret", 2],
  ["212 Women", 1],
  ["360° Red for Men", 1],
  ["9PM", 1],
  ["Bathikh", 1],
  ["Chrome Eau de Toilette", 1],
  ["Crema Victoria's Secret", 1],
  ["Good Girl Blush", 1],
  ["Good Girl Blush Elixir", 1],
  ["Hawas Ice", 1],
  ["Lady Million", 1],
  ["Nautica Blue", 1],
  ["Odyssey Spectra", 1],
  ["Romance", 1],
  ["Skin Care", 3],
  ["Starwalker", 1],
  ["Yara Elixir", 1],
]);

async function main() {
  const write = process.argv.includes("--write");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MIGRATION_TARGET_DB || "test",
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.useDb(process.env.MIGRATION_TARGET_DB || "test", { useCache: true });
  const products = await db.collection("product").find({}).project({ name: 1, volume: 1, available: 1 }).toArray();
  const names = new Set(products.map((product) => product.name));
  const missing = [...physicalStock.keys()].filter((name) => !names.has(name));
  if (missing.length) throw new Error(`Productos no encontrados: ${missing.join(", ")}`);

  const changes = products
    .map((product) => ({
      id: product._id,
      name: product.name,
      from: Number(product.available) || 0,
      to:
        product.name === "Chrome Eau de Toilette" && Number(product.volume) !== 100
          ? 0
          : product.name === "Club de Nuit Intense" && Number(product.volume) !== 105
            ? 0
            : product.name === "360° Red for Men" && Number(product.volume) !== 100
              ? 0
            : physicalStock.get(product.name) || 0,
    }))
    .filter((change) => change.from !== change.to);

  if (write && changes.length) {
    await db.collection("product").bulkWrite(changes.map((change) => ({
      updateOne: {
        filter: { _id: change.id, available: change.from },
        update: { $set: { available: change.to, updatedAt: new Date() } },
      },
    })));
  }

  console.log(JSON.stringify({
    dryRun: !write,
    physicalProducts: physicalStock.size,
    physicalUnits: [...physicalStock.values()].reduce((sum, value) => sum + value, 0),
    changes: changes.map(({ id, ...change }) => change),
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

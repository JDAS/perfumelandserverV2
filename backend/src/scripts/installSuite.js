try {
  require("dotenv").config();
} catch (error) {
  // Allow execution when env vars are already provided by the environment.
}

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { installSuite, listSuites } = require("../services/suiteInstallerService");

async function run() {
  const suiteId = process.argv[2] || "commerce-ops";

  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI no esta definida. Configura backend/.env o exporta la variable antes de correr el script."
    );
  }

  const availableSuites = listSuites();
  const suiteExists = availableSuites.some((suite) => suite.id === suiteId);

  if (!suiteExists) {
    throw new Error(
      `Suite no encontrada: ${suiteId}. Disponibles: ${availableSuites
        .map((suite) => suite.id)
        .join(", ")}`
    );
  }

  await connectDB();
  const result = await installSuite(suiteId);

  console.log(`Suite instalada: ${result.suite.name}`);
  result.results.forEach((item) => {
    console.log(`- ${item.apiName}: ${item.action}`);
  });
}

run()
  .catch((error) => {
    console.error("Error instalando suite:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

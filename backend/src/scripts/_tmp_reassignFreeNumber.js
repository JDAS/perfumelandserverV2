require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const mongoose = require("mongoose");
const { getCustomRecordModel } = require("../models/CustomRecord");

// --- Parametros de la tarea ---
const CAMPAIGN_ID = "69e7399c9800ab0a41238d16"; // Dia del padre
const ENTRY_ID = "6a2b5f1620594a6fc77a9449"; // registro que hoy tiene el 117
const EXPECTED_CURRENT = "117"; // guarda: solo cambiar si sigue siendo esto
const APPLY = process.argv.includes("--apply"); // sin esto, solo simula (dry-run)

// Helpers replicados de campaignSyncService.js para mismo formato
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function normalizeEntryNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return String(Number(raw));
  return raw;
}
function generateEntryPool(start, end) {
  const safeStart = Math.min(toNumber(start), toNumber(end));
  const safeEnd = Math.max(toNumber(start), toNumber(end));
  const values = [];
  for (let value = safeStart; value <= safeEnd; value += 1) {
    const width = Math.max(String(value).length, 2);
    values.push(String(value).padStart(width, "0"));
  }
  return values;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    tlsAllowInvalidCertificates: true, // Norton intercepta TLS localmente
  });

  const CampaignModel = getCustomRecordModel("campaign");
  const EntryModel = getCustomRecordModel("campaign_entry");

  const campaign = await CampaignModel.findById(CAMPAIGN_ID).lean();
  if (!campaign) throw new Error("No se encontro la campana " + CAMPAIGN_ID);

  console.log("Campana:", campaign.name, "| rango:", campaign.entry_start, "-", campaign.entry_end);

  // Registro objetivo
  const target = await EntryModel.findById(ENTRY_ID).lean();
  if (!target) throw new Error("No se encontro el registro " + ENTRY_ID);
  console.log("Registro objetivo entry_number actual:", target.entry_number, "| status:", target.status);

  if (normalizeEntryNumber(target.entry_number) !== normalizeEntryNumber(EXPECTED_CURRENT)) {
    throw new Error(
      `Guarda de seguridad: el registro ya no tiene ${EXPECTED_CURRENT} (tiene ${target.entry_number}). Abortado.`
    );
  }

  // Todos los numeros usados en la campana (cualquier participante / estado)
  const allEntries = await EntryModel.find({ campaign_id: CAMPAIGN_ID }).lean();
  const usedSet = new Set(
    allEntries.map((e) => normalizeEntryNumber(e.entry_number)).filter(Boolean)
  );

  const pool = generateEntryPool(campaign.entry_start, campaign.entry_end);
  const available = pool.filter((n) => !usedSet.has(normalizeEntryNumber(n)));

  console.log(
    `Pool total: ${pool.length} | usados: ${usedSet.size} | libres: ${available.length}`
  );

  if (available.length === 0) {
    throw new Error("No hay numeros libres en el rango de la campana.");
  }

  // Elegir uno al azar (como pickRandomValues del sistema)
  const chosen = available[Math.floor(Math.random() * available.length)];

  // Doble verificacion de unicidad
  if (usedSet.has(normalizeEntryNumber(chosen))) {
    throw new Error("El numero elegido resulto ocupado: " + chosen);
  }

  console.log(`\n>>> Cambio propuesto: ${target.entry_number}  ->  ${chosen}`);
  console.log(`    (registro ${ENTRY_ID})`);

  if (!APPLY) {
    console.log("\nDRY-RUN: no se escribio nada. Volver a correr con --apply para aplicar.");
    await mongoose.disconnect();
    return;
  }

  const res = await EntryModel.updateOne(
    { _id: ENTRY_ID, entry_number: target.entry_number },
    { $set: { entry_number: chosen } }
  );
  console.log("\nResultado update:", JSON.stringify(res));

  const after = await EntryModel.findById(ENTRY_ID).lean();
  console.log("entry_number despues:", after.entry_number);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("error:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

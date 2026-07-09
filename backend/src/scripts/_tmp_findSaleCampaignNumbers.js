require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const mongoose = require("mongoose");
const { getCustomRecordModel } = require("../models/CustomRecord");

const SALE_ID = process.argv[2] || "6a2b5f0b8fd87bbee2934dae";

async function main() {
  // Misma base que la app (sin dbName -> "test").
  // tlsAllowInvalidCertificates: el antivirus Norton intercepta TLS localmente
  // y sustituye el certificado de Atlas; sin esto el driver rechaza el handshake.
  await mongoose.connect(process.env.MONGO_URI, {
    tlsAllowInvalidCertificates: true,
  });

  const SaleModel = getCustomRecordModel("sales");
  const EntryModel = getCustomRecordModel("campaign_entry");
  const CampaignModel = getCustomRecordModel("campaign");
  const LinkModel = getCustomRecordModel("campaign_sale_link");

  let sale = null;
  try {
    sale = await SaleModel.findById(SALE_ID).lean();
  } catch (e) {
    sale = null;
  }

  console.log("=== VENTA ===");
  if (!sale) {
    console.log(`No se encontro venta con _id ${SALE_ID}`);
  } else {
    console.log({
      _id: String(sale._id),
      name: sale.name,
      saledate: sale.saledate,
      status: sale.status,
      total: sale.total,
      client_id: sale.client_id,
      seller_id: sale.seller_id,
    });
  }

  const entries = await EntryModel.find({ sale_id: SALE_ID })
    .sort({ entry_index: 1, _id: 1 })
    .lean();

  console.log("\n=== NUMEROS / ACCIONES (campaign_entry) asignados a esta venta ===");
  console.log(`Total: ${entries.length}`);
  for (const e of entries) {
    let campaignName = e.campaign_id;
    try {
      const c = await CampaignModel.findById(e.campaign_id).lean();
      if (c) campaignName = `${c.name} (${e.campaign_id})`;
    } catch {}
    console.log({
      _id: String(e._id),
      entry_number: e.entry_number,
      entry_index: e.entry_index,
      status: e.status,
      participant_name: e.participant_name,
      campaign: campaignName,
      assigned_at: e.assigned_at,
    });
  }

  const links = await LinkModel.find({ sale_id: SALE_ID }).lean();
  console.log("\n=== Vinculos venta-campana (campaign_sale_link) ===");
  console.log(`Total: ${links.length}`);
  for (const l of links) {
    console.log({
      _id: String(l._id),
      campaign_id: l.campaign_id,
      participant_name: l.participant_name,
      sale_amount_snapshot: l.sale_amount_snapshot,
      status: l.status,
    });
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("error:", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

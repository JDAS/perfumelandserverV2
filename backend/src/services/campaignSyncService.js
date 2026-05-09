const { getCustomRecordModel } = require("../models/CustomRecord");
const { recalculateRollupsForParent } = require("../utils/rollupEngine");

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function formatDateOnly(value) {
  const date = toDateOnly(value);
  if (!date) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSaleWithinCampaign(sale, campaign) {
  const saleDate = toDateOnly(sale?.saledate || sale?.createdAt);
  const startDate = toDateOnly(campaign?.start_date);
  const endDate = toDateOnly(campaign?.end_date);

  if (!saleDate || !startDate || !endDate) return false;
  return saleDate >= startDate && saleDate <= endDate;
}

function buildParticipantIdentity(sale, clientRecord = null) {
  if (sale?.client_id) {
    const participantName =
      String(clientRecord?.name || sale?.name || "").trim() ||
      `Cliente ${String(sale.client_id).slice(-6)}`;

    return {
      key: `client:${sale.client_id}`,
      participantName,
      clientId: String(sale.client_id),
    };
  }

  const saleName = String(sale?.name || "").trim();
  if (!saleName) return null;

  return {
    key: `name:${normalizeText(saleName)}`,
    participantName: saleName,
    clientId: "",
  };
}

function normalizeEntryNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) {
    return String(Number(raw));
  }
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

function pickRandomValues(source = [], count = 0) {
  const values = [...source];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values.slice(0, Math.max(count, 0));
}

async function getSaleContext(saleId) {
  const SaleModel = getCustomRecordModel("sales");
  const ClientModel = getCustomRecordModel("client");

  const sale = await SaleModel.findById(saleId).lean();
  if (!sale) {
    const error = new Error("Venta no encontrada");
    error.statusCode = 404;
    throw error;
  }

  let clientRecord = null;
  if (sale.client_id) {
    clientRecord = await ClientModel.findById(sale.client_id).lean();
  }

  return { sale, clientRecord };
}

async function findSalesForIdentity({ campaign, identity }) {
  const SaleModel = getCustomRecordModel("sales");
  const baseQuery = { status: "Completada", total: { $gt: 0 } };

  let sales = [];
  if (identity.clientId) {
    sales = await SaleModel.find({
      ...baseQuery,
      client_id: identity.clientId,
    })
      .sort({ saledate: 1, createdAt: 1, _id: 1 })
      .lean();
  } else {
    sales = await SaleModel.find({
      ...baseQuery,
      name: { $regex: `^${escapeRegex(identity.participantName)}$`, $options: "i" },
    })
      .sort({ saledate: 1, createdAt: 1, _id: 1 })
      .lean();
  }

  return sales.filter((sale) => isSaleWithinCampaign(sale, campaign));
}

async function recalculateCampaignParticipant({ campaign, identity, user = null }) {
  const ParticipantModel = getCustomRecordModel("campaign_participant");
  const EntryModel = getCustomRecordModel("campaign_entry");
  const LinkModel = getCustomRecordModel("campaign_sale_link");

  const sales = await findSalesForIdentity({ campaign, identity });
  const totalSalesAmount = sales.reduce((sum, sale) => sum + toNumber(sale.total), 0);
  const ruleAmount = Math.max(toNumber(campaign.rule_amount), 1);
  const allowCarry = campaign.allow_carry !== false;
  const desiredEntryCount = allowCarry
    ? Math.floor(totalSalesAmount / ruleAmount)
    : sales.reduce((sum, sale) => sum + Math.floor(toNumber(sale.total) / ruleAmount), 0);
  const carryBalance = allowCarry ? totalSalesAmount % ruleAmount : 0;

  let participant = await ParticipantModel.findOne({
    campaign_id: String(campaign._id),
    participant_key: identity.key,
  });

  if (!sales.length && desiredEntryCount === 0 && carryBalance === 0) {
    if (participant) {
      await Promise.all([
        EntryModel.deleteMany({ participant_id: String(participant._id) }),
        LinkModel.deleteMany({ participant_id: String(participant._id) }),
        ParticipantModel.deleteOne({ _id: participant._id }),
      ]);
    }

    return {
      participantId: null,
      participantName: identity.participantName,
      salesCount: 0,
      totalSalesAmount: 0,
      desiredEntryCount: 0,
      carryBalance: 0,
      addedEntries: 0,
      removedEntries: 0,
    };
  }

  const baseValues = {
    campaign_id: String(campaign._id),
    participant_name: identity.participantName,
    participant_key: identity.key,
    client_id: identity.clientId || "",
    total_sales_amount: totalSalesAmount,
    eligible_amount_total: totalSalesAmount,
    carry_balance: carryBalance,
    last_sale_date: formatDateOnly(
      sales.length ? sales[sales.length - 1].saledate || sales[sales.length - 1].createdAt : ""
    ),
    status: "Activo",
    updatedBy: user?._id || undefined,
  };

  if (!participant) {
    participant = await ParticipantModel.create({
      ...baseValues,
      createdBy: user?._id || undefined,
    });
  } else {
    participant.set(baseValues);
    Object.keys(baseValues).forEach((key) => participant.markModified(key));
    await participant.save();
  }

  const participantId = String(participant._id);

  const [existingEntries, otherEntries] = await Promise.all([
    EntryModel.find({
      campaign_id: String(campaign._id),
      participant_id: participantId,
    })
      .sort({ entry_index: 1, createdAt: 1, _id: 1 })
      .lean(),
    EntryModel.find({
      campaign_id: String(campaign._id),
      participant_id: { $ne: participantId },
      status: "Activa",
    }).lean(),
  ]);

  const retainedEntries = existingEntries.slice(0, desiredEntryCount);
  const removableEntries = existingEntries.slice(desiredEntryCount);

  if (removableEntries.length > 0) {
    await EntryModel.deleteMany({
      _id: { $in: removableEntries.map((entry) => entry._id) },
    });
  }

  if (retainedEntries.length > 0) {
    await EntryModel.bulkWrite(
      retainedEntries.map((entry, index) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: {
            $set: {
              participant_name: identity.participantName,
              status: "Activa",
              entry_index: index + 1,
            },
          },
        },
      }))
    );
  }

  const usedNumbers = new Set(
    otherEntries
      .map((entry) => normalizeEntryNumber(entry.entry_number))
      .concat(retainedEntries.map((entry) => normalizeEntryNumber(entry.entry_number)))
      .filter(Boolean)
  );

  const availableNumbers = generateEntryPool(
    campaign.entry_start,
    campaign.entry_end
  ).filter((entryNumber) => !usedNumbers.has(normalizeEntryNumber(entryNumber)));

  const missingCount = Math.max(desiredEntryCount - retainedEntries.length, 0);

  if (missingCount > availableNumbers.length) {
    const error = new Error(
      `La campana ${campaign.name} no tiene suficientes acciones disponibles para ${identity.participantName}`
    );
    error.statusCode = 400;
    throw error;
  }

  const selectedNumbers = pickRandomValues(availableNumbers, missingCount);

  if (selectedNumbers.length > 0) {
    await EntryModel.create(
      selectedNumbers.map((entryNumber, index) => ({
        campaign_id: String(campaign._id),
        participant_id: participantId,
        sale_id: sales.length ? String(sales[sales.length - 1]._id) : "",
        participant_name: identity.participantName,
        entry_number: entryNumber,
        entry_index: retainedEntries.length + index + 1,
        status: "Activa",
        assigned_at: formatDateOnly(new Date()),
        createdBy: user?._id || undefined,
        updatedBy: user?._id || undefined,
      }))
    );
  }

  await LinkModel.deleteMany({
    campaign_id: String(campaign._id),
    participant_id: participantId,
  });

  if (sales.length > 0) {
    await LinkModel.create(
      sales.map((sale) => ({
        campaign_id: String(campaign._id),
        participant_id: participantId,
        sale_id: String(sale._id),
        participant_name: identity.participantName,
        sale_date: formatDateOnly(sale.saledate || sale.createdAt),
        sale_amount_snapshot: toNumber(sale.total),
        status: "Activa",
        createdBy: user?._id || undefined,
        updatedBy: user?._id || undefined,
      }))
    );
  }

  return {
    participantId,
    participantName: identity.participantName,
    salesCount: sales.length,
    totalSalesAmount,
    desiredEntryCount,
    carryBalance,
    addedEntries: selectedNumbers.length,
    removedEntries: removableEntries.length,
  };
}

async function syncSaleCampaigns({ saleId, user = null }) {
  const CampaignModel = getCustomRecordModel("campaign");
  const LinkModel = getCustomRecordModel("campaign_sale_link");
  const ParticipantModel = getCustomRecordModel("campaign_participant");

  const { sale, clientRecord } = await getSaleContext(saleId);
  const currentIdentity = buildParticipantIdentity(sale, clientRecord);
  const existingLinks = await LinkModel.find({ sale_id: String(sale._id) }).lean();
  const existingCampaignIds = [
    ...new Set(existingLinks.map((link) => String(link.campaign_id || "")).filter(Boolean)),
  ];

  const activeCampaigns =
    sale.status === "Completada" && toNumber(sale.total) > 0
      ? await CampaignModel.find({ status: "Activa" }).lean()
      : [];

  const eligibleCampaigns = activeCampaigns.filter((campaign) =>
    isSaleWithinCampaign(sale, campaign)
  );

  const campaignIdsToProcess = [
    ...new Set(
      eligibleCampaigns
        .map((campaign) => String(campaign._id))
        .concat(existingCampaignIds)
        .filter(Boolean)
    ),
  ];

  const campaigns = campaignIdsToProcess.length
    ? await CampaignModel.find({ _id: { $in: campaignIdsToProcess } }).lean()
    : [];

  const linkedParticipantIds = [
    ...new Set(existingLinks.map((link) => String(link.participant_id || "")).filter(Boolean)),
  ];
  const linkedParticipants = linkedParticipantIds.length
    ? await ParticipantModel.find({ _id: { $in: linkedParticipantIds } }).lean()
    : [];
  const linkedParticipantMap = new Map(
    linkedParticipants.map((participant) => [String(participant._id), participant])
  );

  const summary = [];

  for (const campaign of campaigns) {
    const identities = new Map();

    if (
      currentIdentity &&
      String(campaign.status) === "Activa" &&
      isSaleWithinCampaign(sale, campaign) &&
      sale.status === "Completada" &&
      toNumber(sale.total) > 0
    ) {
      identities.set(currentIdentity.key, currentIdentity);
    }

    existingLinks
      .filter((link) => String(link.campaign_id) === String(campaign._id))
      .forEach((link) => {
        const participant = linkedParticipantMap.get(String(link.participant_id || ""));
        if (!participant?.participant_key) return;
        identities.set(String(participant.participant_key), {
          key: String(participant.participant_key),
          participantName: participant.participant_name,
          clientId: String(participant.client_id || ""),
        });
      });

    for (const identity of identities.values()) {
      const result = await recalculateCampaignParticipant({
        campaign,
        identity,
        user,
      });

      summary.push({
        campaignId: String(campaign._id),
        campaignName: campaign.name,
        ...result,
      });
    }

    await recalculateRollupsForParent({
      parentObjectApiName: "campaign",
      parentRecordId: campaign._id,
    });
  }

  return {
    saleId: String(sale._id),
    saleName: sale.name || "",
    processedCampaigns: [...new Set(summary.map((item) => item.campaignId))].length,
    addedEntries: summary.reduce((sum, item) => sum + toNumber(item.addedEntries), 0),
    removedEntries: summary.reduce((sum, item) => sum + toNumber(item.removedEntries), 0),
    summary,
  };
}

module.exports = {
  syncSaleCampaigns,
};

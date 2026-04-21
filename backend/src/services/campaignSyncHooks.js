function toComparable(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const SALES_CAMPAIGN_FIELDS = ["status", "total", "saledate", "client_id", "name"];

function shouldSyncCampaignsForSale({ mode, previousRecord = null, record = null }) {
  if (!record) return false;

  if (mode === "create") {
    return true;
  }

  return SALES_CAMPAIGN_FIELDS.some(
    (field) => toComparable(previousRecord?.[field]) !== toComparable(record?.[field])
  );
}

module.exports = {
  SALES_CAMPAIGN_FIELDS,
  shouldSyncCampaignsForSale,
};

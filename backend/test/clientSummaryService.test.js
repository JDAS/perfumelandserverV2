const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("buildClientSummary returns campaign sale link whatsapp summary grouped by sale", async () => {
  const CampaignSaleLinkModel = {
    findById: () => ({
      lean: async () => ({
        _id: "link-1",
        campaign_id: "campaign-1",
        sale_id: "sale-1",
        participant_name: "Cliente demo",
        sale_amount_snapshot: 48000,
      }),
    }),
  };

  const CampaignModel = {
    findById: () => ({
      lean: async () => ({
        _id: "campaign-1",
        name: "la rifa del Dia del Padre",
      }),
    }),
  };

  const SalesModel = {
    findById: () => ({
      lean: async () => ({
        _id: "sale-1",
        name: "Cliente demo",
        total: 48000,
      }),
    }),
  };

  const CampaignEntryModel = {
    find: () => ({
      lean: async () => [
        { entry_number: "57" },
        { entry_number: "07" },
        { entry_number: "33" },
      ],
    }),
  };

  const SaleItemModel = {
    find: () => ({
      lean: async () => [
        {
          _id: "sale-item-1",
          product: "product-1",
          quantity: 1,
          total: 24000,
          list_price: 24000,
        },
        {
          _id: "sale-item-2",
          product: "product-2",
          quantity: 1,
          total: 24000,
          list_price: 24000,
        },
      ],
    }),
  };

  const ProductModel = {
    find: () => ({
      lean: async () => [
        { _id: "product-1", name: "Moschino I Love Love" },
        { _id: "product-2", name: "360 Black" },
      ],
    }),
  };

  const service = loadWithMocks("src/services/clientSummaryService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => {
        if (apiName === "campaign_sale_link") return CampaignSaleLinkModel;
        if (apiName === "campaign_entry") return CampaignEntryModel;
        if (apiName === "campaign") return CampaignModel;
        if (apiName === "sales") return SalesModel;
        if (apiName === "sale_item") return SaleItemModel;
        if (apiName === "product") return ProductModel;
        return {};
      },
    },
    "../utils/paymentEngine": {
      calculatePayments: () => [],
    },
  });

  const summary = await service.buildClientSummary("campaign_sale_link", "link-1");

  assert.equal(summary.type, "campaign_sale_link");
  assert.deepEqual(summary.numbers, ["07", "33", "57"]);
  assert.match(summary.whatsappText, /Moschino I Love Love y 360 Black/i);
  assert.match(summary.whatsappText, /07, 33, 57/);
  assert.match(summary.whatsappText, /rifa del Dia del Padre/i);
});

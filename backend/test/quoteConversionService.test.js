const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

test("convertQuoteToSale blocks conversion when quote has manual pending items", async () => {
  const QuoteModel = {
    findById: () => ({
      lean: async () => ({
        _id: "quote-1",
        name: "Cliente demo",
        status: "Borrador",
        seller_id: "seller-1",
        type: "Contado",
        quote_date: "2026-04-21",
      }),
    }),
  };

  const QuoteItemModel = {
    find: () => ({
      lean: async () => [
        {
          _id: "item-1",
          product: "",
          manual_product_name: "Perfume manual",
          pending_catalog_completion: true,
        },
      ],
    }),
  };

  const ProductModel = {
    find: () => ({
      lean: async () => [],
    }),
  };

  const service = loadWithMocks("src/services/quoteConversionService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => {
        if (apiName === "quote") return QuoteModel;
        if (apiName === "quote_item") return QuoteItemModel;
        if (apiName === "product") return ProductModel;
        return {};
      },
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./customRecordService": {
      saveRecord: async () => {
        throw new Error("saveRecord should not run");
      },
    },
  });

  await assert.rejects(
    () => service.convertQuoteToSale({ quoteId: "quote-1" }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /pendientes de catalogar/i);
      return true;
    }
  );
});

test("convertQuoteToSale blocks conversion when quote references inactive products", async () => {
  const QuoteModel = {
    findById: () => ({
      lean: async () => ({
        _id: "quote-2",
        name: "Cliente demo",
        status: "Borrador",
        seller_id: "seller-1",
        type: "Contado",
        quote_date: "2026-04-21",
      }),
    }),
  };

  const QuoteItemModel = {
    find: () => ({
      lean: async () => [
        {
          _id: "item-2",
          product: "product-1",
          manual_product_name: "",
          pending_catalog_completion: false,
        },
      ],
    }),
  };

  const ProductModel = {
    find: () => ({
      lean: async () => [{ _id: "product-1", name: "Producto inactivo", isactive: false }],
    }),
  };

  const service = loadWithMocks("src/services/quoteConversionService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => {
        if (apiName === "quote") return QuoteModel;
        if (apiName === "quote_item") return QuoteItemModel;
        if (apiName === "product") return ProductModel;
        return {};
      },
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./customRecordService": {
      saveRecord: async () => {
        throw new Error("saveRecord should not run");
      },
    },
  });

  await assert.rejects(
    () => service.convertQuoteToSale({ quoteId: "quote-2" }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /no esta activo en catalogo/i);
      return true;
    }
  );
});

test("convertQuoteToSale syncs campaigns after creating the sale", async () => {
  const campaignCalls = [];
  const createdSaleItems = [];

  const QuoteModel = {
    findById: () => ({
      lean: async () => ({
        _id: "quote-3",
        name: "Cliente demo",
        status: "Borrador",
        seller_id: "seller-1",
        type: "Contado",
        quote_date: "2026-04-21",
        credittype: "Normal",
        quotes: 1,
      }),
    }),
  };

  const QuoteItemModel = {
    find: () => ({
      lean: async () => [
        {
          _id: "item-3",
          product: "product-3",
          quantity: 1,
          price: 24000,
          list_price: 24000,
          discount: 0,
          discount_scope: "Sin descuento",
        },
      ],
    }),
  };

  const ProductModel = {
    find: () => ({
      lean: async () => [{ _id: "product-3", name: "Producto activo", isactive: true, available: 1 }],
    }),
  };

  const SaleItemModel = {
    create: async (payload) => {
      createdSaleItems.push(payload);
      return {
        ...payload,
        _id: "sale-item-1",
        toObject() {
          return { ...this };
        },
      };
    },
  };

  const saveCalls = [];

  const service = loadWithMocks("src/services/quoteConversionService.js", {
    "../models/CustomRecord": {
      getCustomRecordModel: (apiName) => {
        if (apiName === "quote") return QuoteModel;
        if (apiName === "quote_item") return QuoteItemModel;
        if (apiName === "product") return ProductModel;
        if (apiName === "sale_item") return SaleItemModel;
        if (apiName === "stock") {
          return {
            findOne: () => ({
              sort: () => ({
                lean: async () => null,
              }),
            }),
          };
        }
        return {};
      },
    },
    "../utils/rollupEngine": {
      recalculateParentRollupsFromChild: async () => {},
    },
    "./customRecordService": {
      saveRecord: async (payload) => {
        saveCalls.push(payload);
        if (payload.objectApiName === "sales") {
          return {
            record: {
              _id: "sale-3",
              status: "Borrador",
              toObject() {
                return { _id: "sale-3", status: "Borrador" };
              },
            },
          };
        }

        return {
          record: {
            _id: payload.recordId,
          },
        };
      },
    },
    "./campaignSyncService": {
      syncSaleCampaigns: async (payload) => {
        campaignCalls.push(payload);
      },
    },
  });

  const result = await service.convertQuoteToSale({
    quoteId: "quote-3",
    user: { _id: "user-3" },
  });

  assert.equal(result.saleId, "sale-3");
  assert.equal(createdSaleItems.length, 1);
  assert.deepEqual(campaignCalls, [{ saleId: "sale-3", user: { _id: "user-3" } }]);
});

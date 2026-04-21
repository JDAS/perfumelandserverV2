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

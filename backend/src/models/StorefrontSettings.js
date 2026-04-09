const mongoose = require("mongoose");

const storefrontSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    storefront: {
      themeId: { type: String, default: "boutique-classic" },
      variantId: { type: String, default: "boutique" },
      showCart: { type: Boolean, default: false },
      showWhatsapp: { type: Boolean, default: false },
      whatsappNumber: { type: String, default: "" },
      heroBadge: { type: String, default: "" },
      heroTitle: { type: String, default: "" },
      heroSubtitle: { type: String, default: "" },
      heroPrimaryCtaLabel: { type: String, default: "" },
      heroSecondaryCtaLabel: { type: String, default: "" },
      highlightEyebrow: { type: String, default: "" },
      highlightTitle: { type: String, default: "" },
      featureOneEyebrow: { type: String, default: "" },
      featureOneText: { type: String, default: "" },
      featureTwoEyebrow: { type: String, default: "" },
      featureTwoText: { type: String, default: "" },
      siteTagline: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StorefrontSettings", storefrontSettingsSchema);

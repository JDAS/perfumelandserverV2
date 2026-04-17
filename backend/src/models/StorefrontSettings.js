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
      logoUrl: { type: String, default: "/logoName.png" },
      logoAlt: { type: String, default: "Perfumeland" },
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
    adminTheme: {
      bg: { type: String, default: "#EEF4F9" },
      surface: { type: String, default: "#FFFFFF" },
      surfaceAlt: { type: String, default: "#E7F0F7" },
      primary: { type: String, default: "#163B67" },
      primarySoft: { type: String, default: "#1F4E84" },
      accent: { type: String, default: "#2E95C2" },
      accentDeep: { type: String, default: "#166F97" },
      text: { type: String, default: "#0E2B57" },
      muted: { type: String, default: "#5B7086" },
      border: { type: String, default: "#CCD9E5" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StorefrontSettings", storefrontSettingsSchema);

const StorefrontSettings = require("../models/StorefrontSettings");
const {
  THEMES,
  VARIANTS,
  DEFAULT_STOREFRONT_SETTINGS,
  getThemeById,
  getVariantById,
} = require("../data/storefrontPresets");

function sanitizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function mergeSettings(rawSettings = {}) {
  const settings = {
    ...DEFAULT_STOREFRONT_SETTINGS,
    ...rawSettings,
  };

  const theme = getThemeById(settings.themeId);
  const variant = getVariantById(settings.variantId);

  return {
    ...settings,
    themeId: theme.id,
    variantId: variant.id,
    theme,
    variant,
  };
}

async function getOrCreateSettings() {
  let document = await StorefrontSettings.findOne({ singletonKey: "default" });

  if (!document) {
    document = await StorefrontSettings.create({
      singletonKey: "default",
      storefront: DEFAULT_STOREFRONT_SETTINGS,
    });
  }

  return document;
}

exports.getStorefrontSettings = async (_req, res) => {
  try {
    const document = await getOrCreateSettings();
    return res.json({
      storefront: mergeSettings(document.storefront),
      availableThemes: THEMES,
      availableVariants: VARIANTS,
    });
  } catch (error) {
    console.error("getStorefrontSettings error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.updateStorefrontSettings = async (req, res) => {
  try {
    const payload = req.body?.storefront || {};
    const nextSettings = {
      themeId: sanitizeString(payload.themeId, DEFAULT_STOREFRONT_SETTINGS.themeId),
      variantId: sanitizeString(payload.variantId, DEFAULT_STOREFRONT_SETTINGS.variantId),
      showCart: Boolean(payload.showCart),
      showWhatsapp: Boolean(payload.showWhatsapp),
      whatsappNumber: sanitizeString(payload.whatsappNumber),
      heroBadge: sanitizeString(payload.heroBadge, DEFAULT_STOREFRONT_SETTINGS.heroBadge),
      heroTitle: sanitizeString(payload.heroTitle, DEFAULT_STOREFRONT_SETTINGS.heroTitle),
      heroSubtitle: sanitizeString(
        payload.heroSubtitle,
        DEFAULT_STOREFRONT_SETTINGS.heroSubtitle
      ),
      heroPrimaryCtaLabel: sanitizeString(
        payload.heroPrimaryCtaLabel,
        DEFAULT_STOREFRONT_SETTINGS.heroPrimaryCtaLabel
      ),
      heroSecondaryCtaLabel: sanitizeString(
        payload.heroSecondaryCtaLabel,
        DEFAULT_STOREFRONT_SETTINGS.heroSecondaryCtaLabel
      ),
      siteTagline: sanitizeString(
        payload.siteTagline,
        DEFAULT_STOREFRONT_SETTINGS.siteTagline
      ),
    };

    const document = await StorefrontSettings.findOneAndUpdate(
      { singletonKey: "default" },
      { $set: { storefront: nextSettings } },
      {
        upsert: true,
        new: true,
      }
    );

    return res.json({
      storefront: mergeSettings(document.storefront),
      availableThemes: THEMES,
      availableVariants: VARIANTS,
    });
  } catch (error) {
    console.error("updateStorefrontSettings error:", error);
    return res.status(500).json({ error: error.message });
  }
};

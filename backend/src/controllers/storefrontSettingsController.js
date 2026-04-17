const StorefrontSettings = require("../models/StorefrontSettings");
const {
  THEMES,
  VARIANTS,
  DEFAULT_STOREFRONT_SETTINGS,
  DEFAULT_ADMIN_THEME_SETTINGS,
  getThemeById,
  getVariantById,
} = require("../data/storefrontPresets");

function sanitizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function withDefaultString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
}

function mergeSettings(rawSettings = {}) {
  const settings = { ...DEFAULT_STOREFRONT_SETTINGS, ...rawSettings };

  Object.keys(DEFAULT_STOREFRONT_SETTINGS).forEach((key) => {
    if (typeof DEFAULT_STOREFRONT_SETTINGS[key] === "string") {
      settings[key] = withDefaultString(
        rawSettings?.[key],
        DEFAULT_STOREFRONT_SETTINGS[key]
      );
    }
  });

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

function mergeAdminTheme(rawTheme = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_ADMIN_THEME_SETTINGS).map(([key, fallback]) => [
      key,
      sanitizeColor(rawTheme?.[key], fallback),
    ])
  );
}

async function getOrCreateSettings() {
  let document = await StorefrontSettings.findOne({ singletonKey: "default" });

  if (!document) {
    document = await StorefrontSettings.create({
      singletonKey: "default",
      storefront: DEFAULT_STOREFRONT_SETTINGS,
      adminTheme: DEFAULT_ADMIN_THEME_SETTINGS,
    });
  }

  return document;
}

exports.getStorefrontSettings = async (_req, res) => {
  try {
    const document = await getOrCreateSettings();
    return res.json({
      storefront: mergeSettings(document.storefront),
      adminTheme: mergeAdminTheme(document.adminTheme),
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
    const document = await getOrCreateSettings();
    const storefrontPayload = req.body?.storefront;
    const adminThemePayload = req.body?.adminTheme;

    if (storefrontPayload && typeof storefrontPayload === "object") {
      document.storefront = {
        themeId: sanitizeString(
          storefrontPayload.themeId,
          DEFAULT_STOREFRONT_SETTINGS.themeId
        ),
        variantId: sanitizeString(
          storefrontPayload.variantId,
          DEFAULT_STOREFRONT_SETTINGS.variantId
        ),
        logoUrl: sanitizeString(
          storefrontPayload.logoUrl,
          DEFAULT_STOREFRONT_SETTINGS.logoUrl
        ),
        logoAlt: sanitizeString(
          storefrontPayload.logoAlt,
          DEFAULT_STOREFRONT_SETTINGS.logoAlt
        ),
        showCart: Boolean(storefrontPayload.showCart),
        showWhatsapp: Boolean(storefrontPayload.showWhatsapp),
        whatsappNumber: sanitizeString(storefrontPayload.whatsappNumber),
        heroBadge: sanitizeString(
          storefrontPayload.heroBadge,
          DEFAULT_STOREFRONT_SETTINGS.heroBadge
        ),
        heroTitle: sanitizeString(
          storefrontPayload.heroTitle,
          DEFAULT_STOREFRONT_SETTINGS.heroTitle
        ),
        heroSubtitle: sanitizeString(
          storefrontPayload.heroSubtitle,
          DEFAULT_STOREFRONT_SETTINGS.heroSubtitle
        ),
        heroPrimaryCtaLabel: sanitizeString(
          storefrontPayload.heroPrimaryCtaLabel,
          DEFAULT_STOREFRONT_SETTINGS.heroPrimaryCtaLabel
        ),
        heroSecondaryCtaLabel: sanitizeString(
          storefrontPayload.heroSecondaryCtaLabel,
          DEFAULT_STOREFRONT_SETTINGS.heroSecondaryCtaLabel
        ),
        highlightEyebrow: sanitizeString(
          storefrontPayload.highlightEyebrow,
          DEFAULT_STOREFRONT_SETTINGS.highlightEyebrow
        ),
        highlightTitle: sanitizeString(
          storefrontPayload.highlightTitle,
          DEFAULT_STOREFRONT_SETTINGS.highlightTitle
        ),
        featureOneEyebrow: sanitizeString(
          storefrontPayload.featureOneEyebrow,
          DEFAULT_STOREFRONT_SETTINGS.featureOneEyebrow
        ),
        featureOneText: sanitizeString(
          storefrontPayload.featureOneText,
          DEFAULT_STOREFRONT_SETTINGS.featureOneText
        ),
        featureTwoEyebrow: sanitizeString(
          storefrontPayload.featureTwoEyebrow,
          DEFAULT_STOREFRONT_SETTINGS.featureTwoEyebrow
        ),
        featureTwoText: sanitizeString(
          storefrontPayload.featureTwoText,
          DEFAULT_STOREFRONT_SETTINGS.featureTwoText
        ),
        siteTagline: sanitizeString(
          storefrontPayload.siteTagline,
          DEFAULT_STOREFRONT_SETTINGS.siteTagline
        ),
      };
    }

    if (adminThemePayload && typeof adminThemePayload === "object") {
      document.adminTheme = mergeAdminTheme(adminThemePayload);
    }

    await document.save();

    return res.json({
      storefront: mergeSettings(document.storefront),
      adminTheme: mergeAdminTheme(document.adminTheme),
      availableThemes: THEMES,
      availableVariants: VARIANTS,
    });
  } catch (error) {
    console.error("updateStorefrontSettings error:", error);
    return res.status(500).json({ error: error.message });
  }
};

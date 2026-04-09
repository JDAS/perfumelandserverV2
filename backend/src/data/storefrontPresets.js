const THEMES = [
  {
    id: "boutique-classic",
    name: "Boutique Classic",
    palette: {
      primary: "#0d2f6b",
      primarySoft: "#173b80",
      accent: "#f4a8c7",
      accentSoft: "#f7d7e4",
      secondary: "#a786da",
      background: "#f6f8ff",
      surface: "#ffffff",
      text: "#102750",
      mutedText: "#5e6682",
    },
  },
  {
    id: "editorial-blush",
    name: "Editorial Blush",
    palette: {
      primary: "#7a244f",
      primarySoft: "#93325f",
      accent: "#f6d3dc",
      accentSoft: "#fff1f5",
      secondary: "#e7b8c8",
      background: "#fff8fb",
      surface: "#ffffff",
      text: "#3d1830",
      mutedText: "#7b6172",
    },
  },
  {
    id: "holiday-festive",
    name: "Holiday Festive",
    palette: {
      primary: "#0f5c24",
      primarySoft: "#147332",
      accent: "#e10600",
      accentSoft: "#fff4ea",
      secondary: "#f3b23b",
      background: "#f7fbf6",
      surface: "#fffdf7",
      text: "#18341f",
      mutedText: "#5d6f60",
    },
  },
];

const VARIANTS = [
  {
    id: "boutique",
    name: "Boutique",
    description: "Lujoso, suave y enfocado en destacar productos favoritos.",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Mas limpio, mas aire y una portada enfocada en storytelling.",
  },
  {
    id: "festive",
    name: "Festive",
    description: "Ideal para temporadas especiales o campañas de regalo.",
  },
];

const DEFAULT_STOREFRONT_SETTINGS = {
  themeId: "boutique-classic",
  variantId: "boutique",
  showCart: false,
  showWhatsapp: false,
  whatsappNumber: "",
  heroBadge: "Perfumes que dejan huella",
  heroTitle:
    "Encuentra esa fragancia especial para regalar, enamorar o consentirte.",
  heroSubtitle:
    "Descubre aromas irresistibles, marcas reconocidas y opciones para cada estilo, todo en una experiencia pensada para inspirarte y ayudarte a elegir con facilidad.",
  heroPrimaryCtaLabel: "Ver colección",
  heroSecondaryCtaLabel: "Cotizar por WhatsApp",
  highlightEyebrow: "Selección especial",
  highlightTitle:
    "Fragancias elegidas para que encuentres ese aroma que habla por ti.",
  featureOneEyebrow: "Compra fácil",
  featureOneText: "Explora tus favoritos de forma rápida desde tu celular.",
  featureTwoEyebrow: "Atención cercana",
  featureTwoText: "Te acompañamos por WhatsApp para cotizar y elegir mejor.",
  siteTagline:
    "Perfumeland, una vitrina boutique pensada para explorar y cotizar mejor.",
};

function getThemeById(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

function getVariantById(id) {
  return VARIANTS.find((variant) => variant.id === id) || VARIANTS[0];
}

module.exports = {
  THEMES,
  VARIANTS,
  DEFAULT_STOREFRONT_SETTINGS,
  getThemeById,
  getVariantById,
};

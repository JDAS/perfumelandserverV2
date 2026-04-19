/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { getStorefrontSettings } from "../services/customService";
import { DEFAULT_ADMIN_THEME } from "../theme/adminTheme";

const defaultTheme = {
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
};

const defaultStorefront = {
  themeId: "boutique-classic",
  variantId: "boutique",
  logoUrl: "/logoName.png",
  logoAlt: "Perfumeland",
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
  theme: defaultTheme,
  variant: {
    id: "boutique",
    name: "Boutique",
    description: "",
  },
};

const StorefrontContext = createContext({
  storefront: defaultStorefront,
  adminThemeSettings: DEFAULT_ADMIN_THEME,
  availableThemes: [defaultTheme],
  availableVariants: [defaultStorefront.variant],
  loading: true,
  refreshStorefront: async () => {},
});

export function StorefrontProvider({ children }) {
  const [storefront, setStorefront] = useState(defaultStorefront);
  const [adminThemeSettings, setAdminThemeSettings] = useState(DEFAULT_ADMIN_THEME);
  const [availableThemes, setAvailableThemes] = useState([defaultTheme]);
  const [availableVariants, setAvailableVariants] = useState([
    defaultStorefront.variant,
  ]);
  const [loading, setLoading] = useState(true);

  const refreshStorefront = async () => {
    try {
      const data = await getStorefrontSettings();
      setStorefront(data.storefront || defaultStorefront);
      setAdminThemeSettings(data.adminTheme || DEFAULT_ADMIN_THEME);
      setAvailableThemes(data.availableThemes || [defaultTheme]);
      setAvailableVariants(data.availableVariants || [defaultStorefront.variant]);
    } catch (error) {
      console.error("Error cargando storefront settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStorefront();
  }, []);

  return (
    <StorefrontContext.Provider
      value={{
        storefront,
        adminThemeSettings,
        availableThemes,
        availableVariants,
        loading,
        refreshStorefront,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}

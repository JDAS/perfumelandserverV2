export const ADMIN_BRAND_NAME = "Vitra";
export const DEFAULT_LOGO_URL = "/branding/vitra-logo-responsive.svg";
export const DEFAULT_LOGO_MARK_URL = "/branding/vitra-isotipo.svg";
export const DEFAULT_LOGO_ALT = ADMIN_BRAND_NAME;
export const DEFAULT_ADMIN_LOGO_LIGHT_URL =
  "/branding/vitra-logo-monocromo-light.svg";
export const DEFAULT_ADMIN_LOGO_DARK_URL =
  "/branding/vitra-logo-monocromo-dark.svg";
export const DEFAULT_STOREFRONT_BRAND_NAME = "Perfumeland";
export const DEFAULT_STOREFRONT_LOGO_URL = "/logoName.png";
export const DEFAULT_SOCIAL_IMAGE_URL = DEFAULT_STOREFRONT_LOGO_URL;
export const DEFAULT_STOREFRONT_SITE_TAGLINE =
  "Perfumeland, una vitrina boutique pensada para explorar y cotizar mejor.";
export const DEFAULT_SITE_TAGLINE = DEFAULT_STOREFRONT_SITE_TAGLINE;

export function resolveStorefrontBrandName(storefront) {
  const brandName = String(storefront?.logoAlt || "").trim();
  return brandName || DEFAULT_STOREFRONT_BRAND_NAME;
}

export function resolveStorefrontLogoUrl(storefront) {
  const logoUrl = String(storefront?.logoUrl || "").trim();
  return logoUrl || DEFAULT_STOREFRONT_LOGO_URL;
}

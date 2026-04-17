export const DEFAULT_ADMIN_THEME = {
  themeId: "atlantic-glass",
  bg: "#EEF4F9",
  surface: "#FFFFFF",
  surfaceAlt: "#E7F0F7",
  primary: "#163B67",
  primarySoft: "#1F4E84",
  accent: "#2E95C2",
  accentDeep: "#166F97",
  text: "#0E2B57",
  muted: "#5B7086",
  border: "#CCD9E5",
};

export const ADMIN_THEME_FIELDS = [
  { key: "bg", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "surfaceAlt", label: "Surface Alt" },
  { key: "primary", label: "Primary" },
  { key: "primarySoft", label: "Primary Soft" },
  { key: "accent", label: "Accent" },
  { key: "accentDeep", label: "Accent Deep" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "border", label: "Border" },
];

export const adminTheme = {
  bg: "var(--admin-bg, #EEF4F9)",
  surface: "var(--admin-surface, #FFFFFF)",
  surfaceAlt: "var(--admin-surface-alt, #E7F0F7)",
  primary: "var(--admin-primary, #163B67)",
  primarySoft: "var(--admin-primary-soft, #1F4E84)",
  accent: "var(--admin-accent, #2E95C2)",
  accentDeep: "var(--admin-accent-deep, #166F97)",
  text: "var(--admin-text, #0E2B57)",
  muted: "var(--admin-muted, #5B7086)",
  border: "var(--admin-border, #CCD9E5)",
};

export function resolveAdminTheme(theme = {}) {
  return {
    ...DEFAULT_ADMIN_THEME,
    ...theme,
  };
}

export function getAdminThemeCssVars(theme = {}) {
  const resolvedTheme = resolveAdminTheme(theme);

  return {
    "--admin-bg": resolvedTheme.bg,
    "--admin-surface": resolvedTheme.surface,
    "--admin-surface-alt": resolvedTheme.surfaceAlt,
    "--admin-primary": resolvedTheme.primary,
    "--admin-primary-soft": resolvedTheme.primarySoft,
    "--admin-accent": resolvedTheme.accent,
    "--admin-accent-deep": resolvedTheme.accentDeep,
    "--admin-text": resolvedTheme.text,
    "--admin-muted": resolvedTheme.muted,
    "--admin-border": resolvedTheme.border,
  };
}

export function adminGradient(themeValues = adminTheme) {
  return `linear-gradient(135deg, ${themeValues.primary} 0%, ${themeValues.primarySoft} 100%)`;
}

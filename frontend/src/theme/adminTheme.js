export const adminTheme = {
  bg: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceAlt: "#EDF2F7",
  primary: "#111827",
  primarySoft: "#1F2937",
  accent: "#F59E0B",
  accentDeep: "#EF4444",
  text: "#142133",
  muted: "#607086",
  border: "#D7DEE8",
};

export function adminGradient() {
  return `linear-gradient(135deg, ${adminTheme.primary} 0%, ${adminTheme.primarySoft} 100%)`;
}

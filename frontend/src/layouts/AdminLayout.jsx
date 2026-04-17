import { Link } from "react-router-dom";
import UserMenu from "../components/UserMenu";
import { useStorefront } from "../context/StorefrontContext";
import { DEFAULT_LOGO_URL } from "../constants/branding";
import {
  adminGradient,
  adminTheme,
  getAdminThemeCssVars,
} from "../theme/adminTheme";

function AdminLayout({ children }) {
  const { adminThemeSettings } = useStorefront();

  return (
    <div
      className="min-h-screen"
      style={{
        ...getAdminThemeCssVars(adminThemeSettings),
        background: `linear-gradient(180deg, ${adminTheme.bg} 0%, ${adminTheme.surfaceAlt} 100%)`,
        color: adminTheme.text,
      }}
    >
      <header
        className="flex justify-between items-center p-4 text-white border-b shadow-[0_16px_40px_rgba(17,24,39,0.24)]"
        style={{
          background: adminGradient(),
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-6">
          <Link to="/admin" className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/95 px-4 py-2 shadow-[0_12px_32px_rgba(14,43,87,0.18)]">
              <img src={DEFAULT_LOGO_URL} alt="Vitra" className="h-11 w-auto" />
            </div>
          </Link>
        </div>

        <UserMenu />
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}

export default AdminLayout;

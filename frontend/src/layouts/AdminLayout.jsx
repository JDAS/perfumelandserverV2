import { Link } from "react-router-dom";
import UserMenu from "../components/UserMenu";
import { adminGradient, adminTheme } from "../theme/adminTheme";
import { DEFAULT_ADMIN_LOGO_LIGHT_URL } from "../constants/branding";

function AdminLayout({ children }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${adminTheme.bg} 0%, #eef2f7 100%)`,
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
            <img
              src={DEFAULT_ADMIN_LOGO_LIGHT_URL}
              alt="Vitra"
              className="h-12 w-auto"
            />
          </Link>
        </div>

        <UserMenu />
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}

export default AdminLayout;

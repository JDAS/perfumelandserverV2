import { Link } from "react-router-dom";
import UserMenu from "../components/UserMenu";
import { adminGradient, adminTheme } from "../theme/adminTheme";

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
              src="/branding/vitra-admin-logo.svg"
              alt="Vitra"
              className="h-10 w-auto"
            />
            <div className="leading-tight">
              <p className="text-xl font-semibold tracking-tight text-white">Vitra</p>
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">
                Panel administrativo
              </p>
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

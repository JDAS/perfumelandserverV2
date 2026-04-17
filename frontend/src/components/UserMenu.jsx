import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { adminTheme } from "../theme/adminTheme";

function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => navigate("/login")}
        className="rounded-lg px-4 py-2"
        style={{ backgroundColor: adminTheme.surface, color: adminTheme.text }}
      >
        Login
      </button>
    );
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-2xl border px-3 py-2"
        style={{
          backgroundColor: "rgba(255,255,255,0.12)",
          borderColor: "rgba(255,255,255,0.16)",
        }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold"
          style={{ color: adminTheme.text }}
        >
          {initials}
        </div>

        <div className="hidden text-left sm:block">
          <p className="text-sm font-semibold leading-none">{user.name}</p>
          <p className="mt-1 text-xs text-white/70">{user.email}</p>
        </div>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border p-4 shadow-lg"
          style={{
            backgroundColor: adminTheme.surface,
            color: adminTheme.text,
            borderColor: adminTheme.border,
          }}
        >
          <div className="mb-3 border-b pb-3" style={{ borderColor: adminTheme.border }}>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm" style={{ color: adminTheme.muted }}>
              {user.email}
            </p>
            <p className="mt-1 text-xs" style={{ color: adminTheme.muted }}>
              {user.isAdmin ? "Administrador" : "Usuario"}
            </p>
          </div>

          {user.isAdmin && (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/admin/settings");
              }}
              className="w-full rounded px-3 py-2 text-left"
              style={{ color: adminTheme.text }}
            >
              Configuracion
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full rounded px-3 py-2 text-left"
            style={{ color: adminTheme.accentDeep }}
          >
            Cerrar sesion
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;

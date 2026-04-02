import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

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
        className="bg-white text-black px-4 py-2 rounded-lg"
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
        className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl"
      >
        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold">
          {initials}
        </div>

        <div className="text-left hidden sm:block">
          <p className="text-sm font-semibold leading-none">{user.name}</p>
          <p className="text-xs text-gray-300 mt-1">{user.email}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white text-black rounded-xl shadow-lg border p-4 z-50">
          <div className="border-b pb-3 mb-3">
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              {user.isAdmin ? "Administrador" : "Usuario"}
            </p>
          </div>

          {user.isAdmin && (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/admin/settings");
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100"
            >
              Configuración
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-red-600"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
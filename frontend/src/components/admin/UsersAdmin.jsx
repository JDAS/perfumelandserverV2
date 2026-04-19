import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminUser, getUsers } from "../../services/authService";
import { useToast } from "../ui/ToastContext";
import { useAuthStore } from "../../store/authStore";
import { adminGradient, adminTheme } from "../../theme/adminTheme";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  isAdmin: false,
};

function formatDate(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString();
}

export default function UsersAdmin() {
  const { addToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const totalAdmins = useMemo(
    () => users.filter((user) => user.isAdmin).length,
    [users]
  );

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.message || "No se pudieron cargar los usuarios",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChange = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      addToast("Nombre, correo y contrasena son obligatorios", "warning");
      return;
    }

    if (form.password !== form.confirmPassword) {
      addToast("Las contrasenas no coinciden", "warning");
      return;
    }

    try {
      setSaving(true);
      const result = await createAdminUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        isAdmin: form.isAdmin,
      });

      addToast(
        `${result?.user?.name || "Usuario"} creado correctamente`,
        "success"
      );
      setForm(defaultForm);
      await loadUsers();
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.message || "No se pudo crear el usuario",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-2xl border p-6" style={{ borderColor: adminTheme.border }}>
        <div className="mb-6">
          <h3 className="text-xl font-bold" style={{ color: adminTheme.text }}>
            Registrar usuario
          </h3>
          <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
            Crea accesos internos desde configuracion sin depender del registro publico.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium" style={{ color: adminTheme.text }}>
              Nombre
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              style={{ borderColor: adminTheme.border }}
              placeholder="Nombre del usuario"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium" style={{ color: adminTheme.text }}>
              Correo
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              style={{ borderColor: adminTheme.border }}
              placeholder="correo@empresa.com"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium" style={{ color: adminTheme.text }}>
                Contrasena
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                style={{ borderColor: adminTheme.border }}
                placeholder="Temporal o definitiva"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium" style={{ color: adminTheme.text }}>
                Confirmar contrasena
              </span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  handleChange("confirmPassword", event.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
                style={{ borderColor: adminTheme.border }}
                placeholder="Repite la contrasena"
              />
            </label>
          </div>

          <label
            className="flex items-center gap-3 rounded-xl border p-4"
            style={{ borderColor: adminTheme.border }}
          >
            <input
              type="checkbox"
              checked={Boolean(form.isAdmin)}
              onChange={(event) => handleChange("isAdmin", event.target.checked)}
            />
            <div>
              <p className="font-medium" style={{ color: adminTheme.text }}>
                Permisos de administrador
              </p>
              <p className="text-sm" style={{ color: adminTheme.muted }}>
                Habilita acceso a admin, configuracion y workspace interno.
              </p>
            </div>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: adminGradient() }}
            >
              {saving ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border p-6" style={{ borderColor: adminTheme.border }}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold" style={{ color: adminTheme.text }}>
              Usuarios registrados
            </h3>
            <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
              Vista rapida de accesos creados en el sistema.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }}
            >
              {users.length} usuarios
            </span>
            <span
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: "#ECFDF3", color: "#166534" }}
            >
              {totalAdmins} admin
            </span>
          </div>
        </div>

        {loading ? (
          <p style={{ color: adminTheme.muted }}>Cargando usuarios...</p>
        ) : users.length === 0 ? (
          <p style={{ color: adminTheme.muted }}>Aun no hay usuarios creados.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isCurrentUser = String(user._id) === String(currentUser?._id || "");

              return (
                <div
                  key={user._id}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" style={{ color: adminTheme.text }}>
                          {user.name}
                        </p>
                        {user.isAdmin ? (
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{ backgroundColor: "#ECFDF3", color: "#166534" }}
                          >
                            Admin
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor: adminTheme.surfaceAlt,
                              color: adminTheme.muted,
                            }}
                          >
                            Usuario
                          </span>
                        )}
                        {isCurrentUser ? (
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor: "#EFF6FF",
                              color: "#1D4ED8",
                            }}
                          >
                            Tu sesion
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
                        {user.email}
                      </p>
                    </div>

                    <div className="text-right text-xs" style={{ color: adminTheme.muted }}>
                      <p>Creado: {formatDate(user.createdAt)}</p>
                      <p className="mt-1">Actualizado: {formatDate(user.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

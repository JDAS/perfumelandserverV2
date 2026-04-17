import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  bootstrapAdmin,
  getBootstrapStatus,
  login,
} from "../services/authService";
import { useToast } from "../components/ui/ToastContext";
import { useStorefront } from "../context/StorefrontContext";
import { DEFAULT_LOGO_URL } from "../constants/branding";
import {
  adminGradient,
  adminTheme,
  getAdminThemeCssVars,
} from "../theme/adminTheme";

function LoginPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { addToast } = useToast();
  const { adminThemeSettings } = useStorefront();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [setupForm, setSetupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    setupToken: "",
  });
  const [loading, setLoading] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [bootstrapState, setBootstrapState] = useState({
    requiresSetup: false,
    bootstrapEnabled: false,
    message: "",
  });

  useEffect(() => {
    let active = true;

    async function loadBootstrapStatus() {
      try {
        const data = await getBootstrapStatus();
        if (!active) return;
        setBootstrapState({
          requiresSetup: Boolean(data?.requiresSetup),
          bootstrapEnabled: Boolean(data?.bootstrapEnabled),
          message: String(data?.message || ""),
        });
      } catch (error) {
        console.error(error);
        if (!active) return;
        setBootstrapState({
          requiresSetup: false,
          bootstrapEnabled: false,
          message: "",
        });
      } finally {
        if (active) {
          setCheckingBootstrap(false);
        }
      }
    }

    loadBootstrapStatus();

    return () => {
      active = false;
    };
  }, []);

  if (user) {
    return <Navigate to={user.isAdmin ? "/admin" : "/"} />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSetupChange = (event) => {
    const { name, value } = event.target;
    setSetupForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email || !form.password) {
      addToast("Debes completar email y contrasena", "warning");
      return;
    }

    try {
      setLoading(true);

      const data = await login(form);

      setAuth({
        user: data.user,
        token: data.token,
      });

      navigate(data.user?.isAdmin ? "/admin" : "/");
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.message || "Error al iniciar sesion",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapSubmit = async (event) => {
    event.preventDefault();

    if (
      !setupForm.name.trim() ||
      !setupForm.email.trim() ||
      !setupForm.password ||
      !setupForm.setupToken.trim()
    ) {
      addToast("Completa todos los campos del setup inicial", "warning");
      return;
    }

    if (setupForm.password !== setupForm.confirmPassword) {
      addToast("Las contrasenas no coinciden", "warning");
      return;
    }

    if (!bootstrapState.bootstrapEnabled) {
      addToast(
        bootstrapState.message || "El setup inicial no esta habilitado",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      const data = await bootstrapAdmin({
        name: setupForm.name.trim(),
        email: setupForm.email.trim(),
        password: setupForm.password,
        setupToken: setupForm.setupToken.trim(),
      });

      setAuth({
        user: data.user,
        token: data.token,
      });

      navigate("/admin");
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.message ||
          "No se pudo crear el administrador inicial",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        ...getAdminThemeCssVars(adminThemeSettings),
        background: `radial-gradient(circle at top left, ${adminTheme.accent}22 0%, transparent 28%), linear-gradient(180deg, ${adminTheme.bg} 0%, ${adminTheme.surfaceAlt} 100%)`,
      }}
    >
      <div
        className="w-full max-w-md rounded-[28px] border p-8 shadow-[0_28px_80px_rgba(14,43,87,0.14)]"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div className="mb-8 flex justify-center">
          <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_12px_32px_rgba(14,43,87,0.12)]">
            <img src={DEFAULT_LOGO_URL} alt="Vitra" className="h-12 w-auto" />
          </div>
        </div>
        {checkingBootstrap ? (
          <>
            <h1 className="mb-2 text-2xl font-bold" style={{ color: adminTheme.text }}>
              Preparando acceso
            </h1>
            <p className="text-sm" style={{ color: adminTheme.muted }}>
              Verificando si este proyecto necesita configuracion inicial...
            </p>
          </>
        ) : bootstrapState.requiresSetup ? (
          <>
            <h1 className="mb-2 text-2xl font-bold" style={{ color: adminTheme.text }}>
              Configurar administrador inicial
            </h1>
            <p className="mb-6 text-sm" style={{ color: adminTheme.muted }}>
              Este proyecto aun no tiene usuarios. Crea aqui el primer admin.
            </p>

            {bootstrapState.message ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bootstrapState.message}
              </div>
            ) : null}

            <form onSubmit={handleBootstrapSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Nombre
                </label>
                <input
                  type="text"
                  name="name"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={setupForm.name}
                  onChange={handleSetupChange}
                  placeholder="Admin principal"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Correo
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={setupForm.email}
                  onChange={handleSetupChange}
                  placeholder="admin@cliente.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Contrasena
                </label>
                <input
                  type="password"
                  name="password"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={setupForm.password}
                  onChange={handleSetupChange}
                  placeholder="********"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Confirmar contrasena
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={setupForm.confirmPassword}
                  onChange={handleSetupChange}
                  placeholder="********"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Token de bootstrap
                </label>
                <input
                  type="password"
                  name="setupToken"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={setupForm.setupToken}
                  onChange={handleSetupChange}
                  placeholder="BOOTSTRAP_ADMIN_TOKEN"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !bootstrapState.bootstrapEnabled}
                className="w-full rounded-lg py-3 text-white disabled:opacity-60"
                style={{ background: adminGradient() }}
              >
                {loading ? "Creando admin..." : "Crear administrador inicial"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold" style={{ color: adminTheme.text }}>
              Iniciar sesion
            </h1>
            <p className="mb-6 text-sm" style={{ color: adminTheme.muted }}>
              Accede a tu cuenta para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Correo
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
                  Contrasena
                </label>
                <input
                  type="password"
                  name="password"
                  className="w-full rounded-lg border p-3"
                  style={{ borderColor: adminTheme.border }}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="********"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-3 text-white disabled:opacity-60"
                style={{ background: adminGradient() }}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;

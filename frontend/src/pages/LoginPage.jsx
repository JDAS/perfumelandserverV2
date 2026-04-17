import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  bootstrapAdmin,
  getBootstrapStatus,
  login,
} from "../services/authService";
import { useToast } from "../components/ui/ToastContext";
import { DEFAULT_LOGO_URL } from "../constants/branding";

function LoginPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { addToast } = useToast();

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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <div className="mb-8 flex justify-center">
          <img src={DEFAULT_LOGO_URL} alt="Vitra" className="h-12 w-auto" />
        </div>
        {checkingBootstrap ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Preparando acceso</h1>
            <p className="text-sm text-gray-500">
              Verificando si este proyecto necesita configuracion inicial...
            </p>
          </>
        ) : bootstrapState.requiresSetup ? (
          <>
            <h1 className="text-2xl font-bold mb-2">
              Configurar administrador inicial
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Este proyecto aun no tiene usuarios. Crea aqui el primer admin.
            </p>

            {bootstrapState.message ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bootstrapState.message}
              </div>
            ) : null}

            <form onSubmit={handleBootstrapSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Nombre</label>
                <input
                  type="text"
                  name="name"
                  className="w-full border rounded-lg p-3"
                  value={setupForm.name}
                  onChange={handleSetupChange}
                  placeholder="Admin principal"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Correo</label>
                <input
                  type="email"
                  name="email"
                  className="w-full border rounded-lg p-3"
                  value={setupForm.email}
                  onChange={handleSetupChange}
                  placeholder="admin@cliente.com"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Contrasena
                </label>
                <input
                  type="password"
                  name="password"
                  className="w-full border rounded-lg p-3"
                  value={setupForm.password}
                  onChange={handleSetupChange}
                  placeholder="********"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Confirmar contrasena
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="w-full border rounded-lg p-3"
                  value={setupForm.confirmPassword}
                  onChange={handleSetupChange}
                  placeholder="********"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Token de bootstrap
                </label>
                <input
                  type="password"
                  name="setupToken"
                  className="w-full border rounded-lg p-3"
                  value={setupForm.setupToken}
                  onChange={handleSetupChange}
                  placeholder="BOOTSTRAP_ADMIN_TOKEN"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !bootstrapState.bootstrapEnabled}
                className="w-full bg-black text-white rounded-lg py-3 disabled:opacity-60"
              >
                {loading ? "Creando admin..." : "Crear administrador inicial"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Iniciar sesion</h1>
            <p className="text-sm text-gray-500 mb-6">
              Accede a tu cuenta para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Correo</label>
                <input
                  type="email"
                  name="email"
                  className="w-full border rounded-lg p-3"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Contrasena
                </label>
                <input
                  type="password"
                  name="password"
                  className="w-full border rounded-lg p-3"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="********"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white rounded-lg py-3 disabled:opacity-60"
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

import { useEffect, useState } from "react";
import { installSuite, getSuites } from "../services/customService";
import { useToast } from "./ui/ToastContext";

function SuiteSetupPanel({ onInstalled }) {
  const { addToast } = useToast();
  const [suites, setSuites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installingSuiteId, setInstallingSuiteId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSuites() {
      try {
        setLoading(true);
        const data = await getSuites();
        if (!active) return;
        setSuites(data || []);
      } catch (error) {
        console.error("Error cargando suites:", error);
        if (!active) return;
        addToast(
          error?.response?.data?.error || "No se pudieron cargar las suites",
          "error"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSuites();

    return () => {
      active = false;
    };
  }, [addToast]);

  const handleInstall = async (suiteId) => {
    try {
      setInstallingSuiteId(suiteId);
      const result = await installSuite(suiteId);
      addToast(
        `Suite instalada: ${result?.suite?.name || suiteId}`,
        "success"
      );
      await onInstalled?.(result);
    } catch (error) {
      console.error("Error instalando suite:", error);
      addToast(
        error?.response?.data?.error || "No se pudo instalar la suite",
        "error"
      );
    } finally {
      setInstallingSuiteId("");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow">
        <p className="text-gray-500">Cargando suites disponibles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold">Instalar una Suite</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Una suite crea de una vez los objetos base del sistema. Piensalo como
          un dominio funcional listo para usar, sin llamarlo cloud.
        </p>
      </div>

      {suites.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 shadow">
          <p className="text-gray-500">No hay suites disponibles.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {suites.map((suite) => {
            const isInstalling = installingSuiteId === suite.id;

            return (
              <div
                key={suite.id}
                className="rounded-2xl bg-white p-8 shadow transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Suite
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">{suite.name}</h2>
                  </div>
                  <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {suite.objectCount} objetos
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-gray-600">
                  {suite.description}
                </p>

                <button
                  type="button"
                  onClick={() => handleInstall(suite.id)}
                  disabled={Boolean(installingSuiteId)}
                  className="mt-6 rounded-xl bg-black px-5 py-3 text-white disabled:opacity-60"
                >
                  {isInstalling ? "Instalando..." : "Crear suite"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SuiteSetupPanel;

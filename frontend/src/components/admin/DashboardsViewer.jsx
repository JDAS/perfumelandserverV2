import { useEffect, useState } from "react";
import { getDashboards } from "../../services/customService";
import DashboardRenderer from "./DashboardRenderer";

export default function DashboardsViewer() {
  const [dashboards, setDashboards] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardsData() {
      try {
        setLoading(true);
        const data = await getDashboards();
        if (!cancelled) {
          const activeDashboards = (data || []).filter(
            (dashboard) => dashboard.isActive !== false
          );
          setDashboards(activeDashboards);
          if (activeDashboards[0]) {
            setSelectedId(String(activeDashboards[0]._id));
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboardsData();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDashboard =
    dashboards.find((dashboard) => String(dashboard._id) === selectedId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Visualizador de dashboards</h2>
        <p className="mt-1 text-sm text-gray-500">
          Consulta los dashboards activos ya armados en configuración.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-xl bg-white p-4 shadow">
          <div>
            <h3 className="text-lg font-bold">Dashboards activos</h3>
            <p className="mt-1 text-sm text-gray-500">
              Abre uno para ver sus widgets y reportes conectados.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-gray-500">Cargando dashboards...</p> : null}
            {!loading && dashboards.length === 0 ? (
              <p className="text-sm text-gray-500">No hay dashboards activos.</p>
            ) : null}
            {dashboards.map((dashboard) => (
              <button
                key={dashboard._id}
                onClick={() => setSelectedId(String(dashboard._id))}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedId === String(dashboard._id)
                    ? "border-black bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <p className="font-semibold text-gray-900">{dashboard.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                  {(dashboard.widgets || []).length} widgets
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl bg-white p-6 shadow">
          {selectedDashboard ? (
            <DashboardRenderer dashboard={selectedDashboard} />
          ) : (
            <p className="text-sm text-gray-500">
              Selecciona un dashboard para visualizarlo.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

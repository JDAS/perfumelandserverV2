import { useEffect, useMemo, useState } from "react";
import {
  createDashboard,
  deleteDashboard,
  getDashboards,
  getReports,
  updateDashboard,
} from "../../services/customService";
import { useToast } from "../ui/ToastContext";
import DashboardRenderer from "./DashboardRenderer";

const defaultWidget = {
  id: "",
  type: "kpi",
  title: "",
  reportId: "",
  chartType: "bar",
  xField: "",
  series: [],
  columns: [],
  metricId: "",
  size: "half",
  options: {},
};

const defaultDashboard = {
  name: "",
  apiName: "",
  description: "",
  isActive: true,
  widgets: [],
};

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createWidgetId() {
  return `widget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateListAtIndex(items, index, changes) {
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...changes } : item
  );
}

export default function DashboardsAdmin() {
  const { addToast } = useToast();
  const [dashboards, setDashboards] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(defaultDashboard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const reportMap = useMemo(
    () => new Map(reports.map((report) => [String(report._id), report])),
    [reports]
  );

  const previewDashboard = useMemo(
    () => ({
      ...form,
      widgets: (form.widgets || []).map((widget) => ({
        ...widget,
        report: reportMap.get(String(widget.reportId)) || null,
      })),
    }),
    [form, reportMap]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardsData, reportsData] = await Promise.all([
        getDashboards(),
        getReports(),
      ]);
      setDashboards(dashboardsData || []);
      setReports(reportsData || []);
    } catch (error) {
      console.error(error);
      addToast("No se pudieron cargar dashboards o reportes", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedId("");
    setForm(defaultDashboard);
  };

  const handleSelect = (dashboard) => {
    setSelectedId(dashboard._id);
    setForm({
      ...defaultDashboard,
      ...dashboard,
      widgets: dashboard.widgets || [],
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        apiName: slugify(form.apiName || form.name),
        widgets: (form.widgets || []).map((widget) => {
          const cleaned = { ...widget };
          delete cleaned.report;
          return cleaned;
        }),
      };

      const saved = selectedId
        ? await updateDashboard(selectedId, payload)
        : await createDashboard(payload);

      await loadData();
      handleSelect(saved);
      addToast("Dashboard guardado", "success");
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo guardar el dashboard", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm("¿Eliminar este dashboard?")) return;

    try {
      await deleteDashboard(selectedId);
      await loadData();
      resetForm();
      addToast("Dashboard eliminado", "success");
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo eliminar el dashboard", "error");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-xl bg-white p-4 shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Dashboards</h2>
            <p className="text-sm text-gray-500">
              Combina widgets KPI, graficas y tablas.
            </p>
          </div>
          <button onClick={resetForm} className="rounded-lg bg-black px-3 py-2 text-sm text-white">
            Nuevo
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-gray-500">Cargando dashboards...</p> : null}
          {!loading && dashboards.length === 0 ? (
            <p className="text-sm text-gray-500">Todavia no hay dashboards creados.</p>
          ) : null}
          {dashboards.map((dashboard) => (
            <button
              key={dashboard._id}
              onClick={() => handleSelect(dashboard)}
              className={`w-full rounded-xl border p-3 text-left ${
                selectedId === dashboard._id ? "border-black bg-gray-50" : "border-gray-200"
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

      <section className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Nombre</span>
              <input className="w-full rounded-lg border p-3" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">API Name</span>
              <input className="w-full rounded-lg border p-3" value={form.apiName} onChange={(e) => setForm((c) => ({ ...c, apiName: e.target.value }))} placeholder="sales_overview" />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
            <label className="space-y-2">
              <span className="text-sm font-medium">Descripcion</span>
              <textarea className="min-h-24 w-full rounded-lg border p-3" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-4">
              <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} />
              <div>
                <p className="font-medium">Dashboard activo</p>
                <p className="text-sm text-gray-500">Disponible para consulta interna.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Widgets</h3>
              <p className="text-sm text-gray-500">Cada widget consume un reporte guardado.</p>
            </div>
            <button
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  widgets: [
                    ...(current.widgets || []),
                    { ...defaultWidget, id: createWidgetId(), title: "Nuevo widget" },
                  ],
                }))
              }
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Agregar widget
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {(form.widgets || []).map((widget, index) => {
              const report = reportMap.get(String(widget.reportId));
              const groupOptions = report?.groupBy || [];
              const metricOptions = report?.metrics || [];
              const columnOptions = [
                ...(report?.groupBy || []).map((group) => ({
                  id: group.field,
                  label: group.label || group.field,
                })),
                ...(report?.metrics || []).map((metric) => ({
                  id: metric.id,
                  label: metric.label,
                })),
              ];

              return (
                <div key={widget.id} className="rounded-2xl border p-4">
                  <div className="grid gap-3 xl:grid-cols-6">
                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-sm font-medium">Titulo</span>
                      <input className="w-full rounded-lg border p-3" value={widget.title} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { title: e.target.value }) }))} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tipo</span>
                      <select className="w-full rounded-lg border p-3" value={widget.type} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { type: e.target.value }) }))}>
                        <option value="kpi">KPI</option>
                        <option value="chart">Grafica</option>
                        <option value="table">Tabla</option>
                      </select>
                    </label>
                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-sm font-medium">Reporte</span>
                      <select className="w-full rounded-lg border p-3" value={widget.reportId} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { reportId: e.target.value, metricId: "", xField: "", series: [], columns: [] }) }))}>
                        <option value="">Selecciona un reporte</option>
                        {reports.map((reportOption) => (
                          <option key={reportOption._id} value={reportOption._id}>
                            {reportOption.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tamano</span>
                      <select className="w-full rounded-lg border p-3" value={widget.size} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { size: e.target.value }) }))}>
                        <option value="third">1/3</option>
                        <option value="half">1/2</option>
                        <option value="full">Completo</option>
                      </select>
                    </label>
                  </div>

                  {widget.type === "kpi" ? (
                    <div className="mt-3">
                      <label className="space-y-2 block">
                        <span className="text-sm font-medium">Metrica</span>
                        <select className="w-full rounded-lg border p-3" value={widget.metricId} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { metricId: e.target.value }) }))}>
                          <option value="">Selecciona una metrica</option>
                          {metricOptions.map((metric) => (
                            <option key={metric.id} value={metric.id}>
                              {metric.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {widget.type === "chart" ? (
                    <div className="mt-3 grid gap-3 xl:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tipo de grafica</span>
                        <select className="w-full rounded-lg border p-3" value={widget.chartType} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { chartType: e.target.value }) }))}>
                          <option value="bar">Barras</option>
                          <option value="line">Lineas</option>
                          <option value="area">Area</option>
                          <option value="pie">Pie</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Eje X</span>
                        <select className="w-full rounded-lg border p-3" value={widget.xField} onChange={(e) => setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { xField: e.target.value }) }))}>
                          <option value="">Selecciona un campo</option>
                          {groupOptions.map((group) => (
                            <option key={group.field} value={group.field}>
                              {group.label || group.field}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Series</span>
                        <select
                          multiple
                          className="min-h-32 w-full rounded-lg border p-3"
                          value={widget.series}
                          onChange={(e) => {
                            const values = Array.from(e.target.selectedOptions).map((option) => option.value);
                            setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { series: values }) }));
                          }}
                        >
                          {metricOptions.map((metric) => (
                            <option key={metric.id} value={metric.id}>
                              {metric.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {widget.type === "table" ? (
                    <div className="mt-3">
                      <label className="space-y-2 block">
                        <span className="text-sm font-medium">Columnas</span>
                        <select
                          multiple
                          className="min-h-32 w-full rounded-lg border p-3"
                          value={widget.columns}
                          onChange={(e) => {
                            const values = Array.from(e.target.selectedOptions).map((option) => option.value);
                            setForm((c) => ({ ...c, widgets: updateListAtIndex(c.widgets, index, { columns: values }) }));
                          }}
                        >
                          {columnOptions.map((column) => (
                            <option key={column.id} value={column.id}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <button onClick={() => setForm((c) => ({ ...c, widgets: c.widgets.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                      Quitar widget
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div>
              <h3 className="text-lg font-bold">Preview</h3>
              <p className="mt-1 text-sm text-gray-500">Visualiza el dashboard con los widgets actuales.</p>
              <div className="mt-4">
                <DashboardRenderer dashboard={previewDashboard} />
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
              <div>
                <h3 className="text-lg font-bold">Acciones</h3>
                <p className="mt-1 text-sm text-gray-500">Guarda la composicion actual del dashboard.</p>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar dashboard"}
              </button>
              <button onClick={handleDelete} disabled={!selectedId} className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600 disabled:opacity-60">
                Eliminar dashboard
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

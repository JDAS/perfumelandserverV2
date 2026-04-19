import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createReport,
  deleteReport,
  getObjectByApiName,
  getReports,
  runReport,
  updateReport,
} from "../../services/customService";
import { useToast } from "../ui/ToastContext";

const defaultForm = {
  name: "",
  apiName: "",
  description: "",
  isActive: true,
  sourceObject: "",
  filters: [],
  groupBy: [],
  metrics: [],
};

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function emptyFilter() {
  return { field: "", operator: "eq", value: "" };
}

function emptyGroup() {
  return { field: "", label: "", dateGroup: "none" };
}

function emptyMetric() {
  return {
    id: "",
    label: "",
    operation: "sum",
    field: "",
    format: "currency",
  };
}

function updateListAtIndex(items, index, changes) {
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...changes } : item
  );
}

function ReportPreview({ preview }) {
  if (!preview) {
    return (
      <p className="text-sm text-gray-500">
        Guarda o ejecuta el reporte para ver el preview.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Objeto</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.sourceObjectLabel}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
            Registros base
          </p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.totalSourceRecords}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
            Filas devueltas
          </p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.rows?.length || 0}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              {(preview.columns || []).map((column) => (
                <th key={column.id} className="border-b p-3 font-semibold text-gray-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(preview.rows || []).slice(0, 12).map((row, rowIndex) => (
              <tr key={`preview-${rowIndex}`} className="hover:bg-gray-50">
                {(preview.columns || []).map((column) => (
                  <td key={column.id} className="border-b p-3 text-gray-700">
                    {row[`${column.id}__label`] || row[column.id] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsAdmin({ objects }) {
  const { addToast } = useToast();
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [sourceFields, setSourceFields] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const availableObjects = useMemo(
    () => (objects || []).filter((object) => object.active !== false),
    [objects]
  );

  useEffect(() => {
    if (!form.sourceObject) {
      setSourceFields([]);
      return;
    }

    getObjectByApiName(form.sourceObject)
      .then((data) => setSourceFields(data.fields || []))
      .catch((error) => {
        console.error(error);
        setSourceFields([]);
      });
  }, [form.sourceObject]);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getReports();
      setReports(data || []);
    } catch (error) {
      console.error(error);
      addToast("No se pudieron cargar los reportes", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const resetForm = () => {
    setSelectedId("");
    setForm(defaultForm);
    setPreview(null);
  };

  const handleSelect = (report) => {
    setSelectedId(report._id);
    setForm({
      ...defaultForm,
      ...report,
      filters: report.filters || [],
      groupBy: report.groupBy || [],
      metrics: report.metrics || [],
    });
    setPreview(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        apiName: slugify(form.apiName || form.name),
        filters: (form.filters || []).filter((item) => item.field),
        groupBy: (form.groupBy || []).filter((item) => item.field),
        metrics: (form.metrics || []).filter(
          (item) => item.id && item.label && item.operation
        ),
      };

      const saved = selectedId
        ? await updateReport(selectedId, payload)
        : await createReport(payload);

      await loadReports();
      handleSelect(saved);
      addToast("Reporte guardado", "success");
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo guardar el reporte", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm("¿Eliminar este reporte?")) return;

    try {
      await deleteReport(selectedId);
      await loadReports();
      resetForm();
      addToast("Reporte eliminado", "success");
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo eliminar el reporte", "error");
    }
  };

  const handleRun = async () => {
    if (!selectedId) {
      addToast("Guarda primero el reporte para ejecutar el preview", "error");
      return;
    }

    try {
      setRunning(true);
      const data = await runReport(selectedId);
      setPreview(data);
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo ejecutar el reporte", "error");
    } finally {
      setRunning(false);
    }
  };

  const sourceFieldOptions = sourceFields.map((field) => (
    <option key={field.apiName} value={field.apiName}>
      {field.label}
    </option>
  ));

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-xl bg-white p-4 shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Reportes</h2>
            <p className="text-sm text-gray-500">
              Define agregaciones reutilizables para KPI, tablas y graficas.
            </p>
          </div>
          <button onClick={resetForm} className="rounded-lg bg-black px-3 py-2 text-sm text-white">
            Nuevo
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-gray-500">Cargando reportes...</p> : null}
          {!loading && reports.length === 0 ? (
            <p className="text-sm text-gray-500">Todavia no hay reportes creados.</p>
          ) : null}
          {reports.map((report) => (
            <button
              key={report._id}
              onClick={() => handleSelect(report)}
              className={`w-full rounded-xl border p-3 text-left ${
                selectedId === report._id ? "border-black bg-gray-50" : "border-gray-200"
              }`}
            >
              <p className="font-semibold text-gray-900">{report.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                {report.sourceObject}
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
              <input className="w-full rounded-lg border p-3" value={form.apiName} onChange={(e) => setForm((c) => ({ ...c, apiName: e.target.value }))} placeholder="sales_by_day" />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
            <label className="space-y-2">
              <span className="text-sm font-medium">Descripcion</span>
              <textarea className="min-h-24 w-full rounded-lg border p-3" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Objeto fuente</span>
              <select className="w-full rounded-lg border p-3" value={form.sourceObject} onChange={(e) => setForm((c) => ({ ...c, sourceObject: e.target.value, filters: [], groupBy: [], metrics: [] }))}>
                <option value="">Selecciona un objeto</option>
                {availableObjects.map((object) => (
                  <option key={object.apiName} value={object.apiName}>
                    {object.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-3 rounded-xl border p-4">
              <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} />
              <div>
                <p className="font-medium">Reporte activo</p>
                <p className="text-sm text-gray-500">Disponible para dashboards y ejecucion.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Filtros</h3>
              <button onClick={() => setForm((c) => ({ ...c, filters: [...(c.filters || []), emptyFilter()] }))} className="rounded-lg border px-3 py-2 text-sm">Agregar</button>
            </div>
            <div className="mt-4 space-y-3">
              {(form.filters || []).map((filter, index) => (
                <div key={`filter-${index}`} className="rounded-xl border p-3">
                  <div className="grid gap-2">
                    <select className="rounded-lg border p-2" value={filter.field} onChange={(e) => setForm((c) => ({ ...c, filters: updateListAtIndex(c.filters, index, { field: e.target.value }) }))}>
                      <option value="">Campo</option>
                      {sourceFieldOptions}
                    </select>
                    <select className="rounded-lg border p-2" value={filter.operator} onChange={(e) => setForm((c) => ({ ...c, filters: updateListAtIndex(c.filters, index, { operator: e.target.value }) }))}>
                      <option value="eq">Igual</option>
                      <option value="ne">Diferente</option>
                      <option value="gt">Mayor que</option>
                      <option value="gte">Mayor o igual</option>
                      <option value="lt">Menor que</option>
                      <option value="lte">Menor o igual</option>
                      <option value="contains">Contiene</option>
                      <option value="isEmpty">Vacio</option>
                      <option value="notEmpty">Con valor</option>
                    </select>
                    <input className="rounded-lg border p-2" placeholder="Valor" value={filter.value} onChange={(e) => setForm((c) => ({ ...c, filters: updateListAtIndex(c.filters, index, { value: e.target.value }) }))} />
                    <button onClick={() => setForm((c) => ({ ...c, filters: c.filters.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Agrupar por</h3>
              <button onClick={() => setForm((c) => ({ ...c, groupBy: [...(c.groupBy || []), emptyGroup()] }))} className="rounded-lg border px-3 py-2 text-sm">Agregar</button>
            </div>
            <div className="mt-4 space-y-3">
              {(form.groupBy || []).map((group, index) => (
                <div key={`group-${index}`} className="rounded-xl border p-3">
                  <div className="grid gap-2">
                    <select className="rounded-lg border p-2" value={group.field} onChange={(e) => setForm((c) => ({ ...c, groupBy: updateListAtIndex(c.groupBy, index, { field: e.target.value }) }))}>
                      <option value="">Campo</option>
                      {sourceFieldOptions}
                    </select>
                    <input className="rounded-lg border p-2" placeholder="Etiqueta" value={group.label} onChange={(e) => setForm((c) => ({ ...c, groupBy: updateListAtIndex(c.groupBy, index, { label: e.target.value }) }))} />
                    <select className="rounded-lg border p-2" value={group.dateGroup} onChange={(e) => setForm((c) => ({ ...c, groupBy: updateListAtIndex(c.groupBy, index, { dateGroup: e.target.value }) }))}>
                      <option value="none">Sin agrupacion de fecha</option>
                      <option value="day">Dia</option>
                      <option value="month">Mes</option>
                      <option value="year">Ano</option>
                    </select>
                    <button onClick={() => setForm((c) => ({ ...c, groupBy: c.groupBy.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Metricas</h3>
              <button onClick={() => setForm((c) => ({ ...c, metrics: [...(c.metrics || []), emptyMetric()] }))} className="rounded-lg border px-3 py-2 text-sm">Agregar</button>
            </div>
            <div className="mt-4 space-y-3">
              {(form.metrics || []).map((metric, index) => (
                <div key={`metric-${index}`} className="rounded-xl border p-3">
                  <div className="grid gap-2">
                    <input className="rounded-lg border p-2" placeholder="id interno" value={metric.id} onChange={(e) => setForm((c) => ({ ...c, metrics: updateListAtIndex(c.metrics, index, { id: slugify(e.target.value) }) }))} />
                    <input className="rounded-lg border p-2" placeholder="Etiqueta" value={metric.label} onChange={(e) => setForm((c) => ({ ...c, metrics: updateListAtIndex(c.metrics, index, { label: e.target.value }) }))} />
                    <select className="rounded-lg border p-2" value={metric.operation} onChange={(e) => setForm((c) => ({ ...c, metrics: updateListAtIndex(c.metrics, index, { operation: e.target.value }) }))}>
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Avg</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                    <select className="rounded-lg border p-2" value={metric.field} onChange={(e) => setForm((c) => ({ ...c, metrics: updateListAtIndex(c.metrics, index, { field: e.target.value }) }))}>
                      <option value="">Campo</option>
                      <option value="*">Todos (*)</option>
                      {sourceFieldOptions}
                    </select>
                    <select className="rounded-lg border p-2" value={metric.format} onChange={(e) => setForm((c) => ({ ...c, metrics: updateListAtIndex(c.metrics, index, { format: e.target.value }) }))}>
                      <option value="number">Numero</option>
                      <option value="currency">Moneda</option>
                      <option value="percent">Porcentaje</option>
                      <option value="text">Texto</option>
                    </select>
                    <button onClick={() => setForm((c) => ({ ...c, metrics: c.metrics.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div>
              <h3 className="text-lg font-bold">Preview</h3>
              <p className="mt-1 text-sm text-gray-500">Ejecuta el reporte guardado para validar sus filas y columnas.</p>
              <div className="mt-4">
                <ReportPreview preview={preview} />
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
              <div>
                <h3 className="text-lg font-bold">Acciones</h3>
                <p className="mt-1 text-sm text-gray-500">Guarda la definicion o ejecuta el preview.</p>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar reporte"}
              </button>
              <button onClick={handleRun} disabled={running || !selectedId} className="w-full rounded-lg border border-black px-4 py-3 text-black disabled:opacity-60">
                {running ? "Ejecutando..." : "Ejecutar preview"}
              </button>
              <button onClick={handleDelete} disabled={!selectedId} className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600 disabled:opacity-60">
                Eliminar reporte
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

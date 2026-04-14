import { useEffect, useState } from "react";
import { getReports, runReport } from "../../services/customService";

function getTodayDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function FinancialSummaryTable({ preview }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="border-b p-3 font-semibold text-gray-700">Metrica</th>
              <th className="border-b p-3 font-semibold text-gray-700">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(preview.rows || []).map((row) => (
              <tr key={row.metric_id} className="hover:bg-gray-50">
                <td className="border-b p-3 text-gray-700">{row.metric}</td>
                <td className="border-b p-3 font-semibold text-gray-900">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.notes?.length ? (
        <div className="rounded-2xl border bg-amber-50/70 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Como se esta calculando</p>
          <ul className="mt-2 space-y-1">
            {preview.notes.map((note, index) => (
              <li key={`financial-note-${index}`}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PaymentsByDayTable({ preview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Fecha</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.filterDate || "-"}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Pagos</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.payments_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Total recibido</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.payments_total_formatted || "-"}
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
            {(preview.rows || []).map((row) => (
              <tr key={row.payment_id} className="hover:bg-gray-50">
                {(preview.columns || []).map((column) => (
                  <td key={column.id} className="border-b p-3 text-gray-700">
                    {row[column.id] || "-"}
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

function ReportResultsTable({ preview }) {
  if (!preview) {
    return (
      <p className="text-sm text-gray-500">
        Selecciona un reporte para visualizar sus resultados.
      </p>
    );
  }

  if (preview.viewType === "financial_summary") {
    return <FinancialSummaryTable preview={preview} />;
  }

  if (preview.viewType === "payments_by_day") {
    return <PaymentsByDayTable preview={preview} />;
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
            {(preview.rows || []).slice(0, 20).map((row, rowIndex) => (
              <tr key={`report-row-${rowIndex}`} className="hover:bg-gray-50">
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

export default function ReportsViewer() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filterDate, setFilterDate] = useState(getTodayDateInput());

  useEffect(() => {
    let cancelled = false;

    async function loadReportsData() {
      try {
        setLoading(true);
        const data = await getReports();
        if (!cancelled) {
          const activeReports = (data || []).filter((report) => report.isActive !== false);
          setReports(activeReports);
          if (activeReports[0]) {
            setSelectedId(String(activeReports[0]._id));
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

    loadReportsData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      return;
    }

    let cancelled = false;

    async function executeSelectedReport() {
      try {
        setRunning(true);
        const selectedReport = (reports || []).find(
          (report) => String(report._id) === String(selectedId)
        );
        const params =
          selectedReport?.engine === "payments_by_day" ? { date: filterDate } : {};
        const data = await runReport(selectedId, params);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPreview(null);
        }
      } finally {
        if (!cancelled) {
          setRunning(false);
        }
      }
    }

    executeSelectedReport();
    return () => {
      cancelled = true;
    };
  }, [selectedId, reports, filterDate]);

  const selectedReport = (reports || []).find(
    (report) => String(report._id) === String(selectedId)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Visualizador de reportes</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ejecuta y revisa los reportes activos ya configurados en el sistema.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-xl bg-white p-4 shadow">
          <div>
            <h3 className="text-lg font-bold">Reportes activos</h3>
            <p className="mt-1 text-sm text-gray-500">
              Selecciona uno para ver sus resultados.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-gray-500">Cargando reportes...</p> : null}
            {!loading && reports.length === 0 ? (
              <p className="text-sm text-gray-500">No hay reportes activos.</p>
            ) : null}
            {reports.map((report) => (
              <button
                key={report._id}
                onClick={() => setSelectedId(String(report._id))}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedId === String(report._id)
                    ? "border-black bg-gray-50"
                    : "border-gray-200"
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

        <section className="rounded-xl bg-white p-6 shadow">
          {selectedReport?.engine === "payments_by_day" ? (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Dia</label>
                <input
                  type="date"
                  className="rounded-lg border p-2"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
              <p className="text-sm text-gray-500">
                El reporte se recalcula segun la fecha seleccionada.
              </p>
            </div>
          ) : null}
          {running ? (
            <p className="text-sm text-gray-500">Ejecutando reporte...</p>
          ) : (
            <ReportResultsTable preview={preview} />
          )}
        </section>
      </div>
    </div>
  );
}

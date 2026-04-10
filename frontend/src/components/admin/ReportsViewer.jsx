import { useEffect, useState } from "react";
import { getReports, runReport } from "../../services/customService";

function ReportResultsTable({ preview }) {
  if (!preview) {
    return (
      <p className="text-sm text-gray-500">
        Selecciona un reporte para visualizar sus resultados.
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
        const data = await runReport(selectedId);
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
  }, [selectedId]);

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

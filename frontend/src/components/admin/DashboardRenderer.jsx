import { useEffect, useMemo, useState } from "react";
import { runReport } from "../../services/customService";
import ChartWidget from "./ChartWidget";

const EMPTY_REPORT_PARAMS = {};

function formatMetric(value, format = "number") {
  if (value === undefined || value === null) return "-";

  if (format === "currency") {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  if (format === "percent") {
    return `${Number(value || 0).toFixed(2)}%`;
  }

  return new Intl.NumberFormat("es-CR").format(Number(value) || 0);
}

function getMetricMeta(report, metricId) {
  return (report?.metrics || []).find((metric) => metric.id === metricId) || null;
}

function getWidgetSpan(size) {
  if (size === "full") return "lg:col-span-12";
  if (size === "third") return "lg:col-span-4";
  return "lg:col-span-6";
}

function TableWidget({ widget, reportData }) {
  const columns = widget.columns?.length
    ? reportData.columns.filter((column) => widget.columns.includes(column.id))
    : reportData.columns;

  const rows = (reportData.rows || []).slice(0, 8);

  const formatCell = (row, column) => {
    const label = row[`${column.id}__label`];
    if (label !== undefined && label !== null && label !== "") return label;

    const value = row[column.id];
    if (value === undefined || value === null || value === "") return "-";
    if (column.type === "currency") return formatMetric(value, "currency");
    if (column.id.endsWith("_progress") || column.id.endsWith("_margin") || column.id.endsWith("_coverage")) {
      return formatMetric(value, "percent");
    }
    if (column.type === "number") return formatMetric(value, "number");
    return value;
  };

  if (!columns?.length) {
    return <p className="text-sm text-gray-500">Selecciona columnas para la tabla.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            {columns.map((column) => (
              <th key={column.id} className="border-b p-3 font-semibold text-gray-700">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.id} className="border-b p-3 text-gray-700">
                  {formatCell(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiWidget({ widget, report, reportData }) {
  const metricMeta = getMetricMeta(report, widget.metricId);
  const rawValue =
    reportData.summary?.[widget.metricId] ??
    reportData.rows?.[0]?.[widget.metricId] ??
    0;

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
        {metricMeta?.label || widget.metricId}
      </p>
      <p className="mt-3 text-3xl font-bold text-gray-900">
        {formatMetric(rawValue, metricMeta?.format || "number")}
      </p>
    </div>
  );
}

export default function DashboardRenderer({ dashboard, reportParams = EMPTY_REPORT_PARAMS }) {
  const [reportResults, setReportResults] = useState({});
  const [loading, setLoading] = useState(false);

  const reportIds = useMemo(
    () =>
      [
        ...new Set(
          (dashboard?.widgets || []).map((widget) => widget.reportId).filter(Boolean)
        ),
      ],
    [dashboard]
  );

  useEffect(() => {
    if (!reportIds.length) {
      setReportResults({});
      return;
    }

    let cancelled = false;

    async function loadReportResults() {
      try {
        setLoading(true);
        const entries = await Promise.all(
          reportIds.map(async (reportId) => {
            const data = await runReport(reportId, reportParams);
            return [reportId, data];
          })
        );

        if (!cancelled) {
          setReportResults(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReportResults();

    return () => {
      cancelled = true;
    };
  }, [reportIds, reportParams]);

  if (!dashboard) {
    return (
      <p className="text-sm text-gray-500">
        Selecciona un dashboard para visualizarlo.
      </p>
    );
  }

  if (!dashboard.widgets?.length) {
    return (
      <p className="text-sm text-gray-500">
        Agrega widgets para construir este dashboard.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold">{dashboard.name}</h3>
        {dashboard.description ? (
          <p className="mt-1 text-sm text-gray-500">{dashboard.description}</p>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-gray-500">Cargando widgets...</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {dashboard.widgets.map((widget) => {
          const report = widget.report || null;
          const reportData = reportResults[widget.reportId] || null;

          return (
            <section
              key={widget.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${getWidgetSpan(
                widget.size
              )}`}
            >
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  {widget.title}
                </h4>
                {report?.name ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-gray-400">
                    {report.name}
                  </p>
                ) : null}
              </div>

              {!reportData ? (
                <p className="text-sm text-gray-500">Sin datos para este widget.</p>
              ) : widget.type === "kpi" ? (
                <KpiWidget widget={widget} report={report} reportData={reportData} />
              ) : widget.type === "chart" ? (
                <ChartWidget widget={widget} reportData={reportData} />
              ) : (
                <TableWidget widget={widget} reportData={reportData} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getRecords, getReports, runReport } from "../../services/customService";

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

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).catch((error) => {
    console.error(error);
  });
}

function openWhatsappText(text) {
  if (!text) return;
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
}

function UpcomingPaymentsTable({ preview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-rose-500">Vencidos</p>
          <p className="mt-2 text-lg font-semibold text-rose-900">
            {preview.summary?.overdue_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-sky-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Esta semana</p>
          <p className="mt-2 text-lg font-semibold text-sky-900">
            {preview.summary?.week_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Proximos</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.upcoming_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Pendiente</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.pending_total_formatted || "-"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copyText(preview.summary?.whatsapp_text)}
          className="rounded-xl border px-3 py-2 text-sm font-semibold"
        >
          Copiar resumen
        </button>
        <button
          type="button"
          onClick={() => openWhatsappText(preview.summary?.whatsapp_text)}
          className="rounded-xl border px-3 py-2 text-sm font-semibold"
        >
          WhatsApp
        </button>
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
              <tr key={row.payment_plan_id} className="hover:bg-gray-50">
                {(preview.columns || []).map((column) => {
                  const danger = column.id === "status_label" && row.status_bucket === "overdue";
                  const warning = column.id === "status_label" && row.status_bucket === "week";
                  return (
                    <td
                      key={column.id}
                      className={`border-b p-3 ${
                        danger
                          ? "font-semibold text-rose-700"
                          : warning
                            ? "font-semibold text-amber-700"
                            : "text-gray-700"
                      }`}
                    >
                      {row[column.id] || "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!preview.rows?.length ? (
        <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">
          No hay pagos pendientes para este filtro.
        </div>
      ) : null}
    </div>
  );
}

function StreetInvestmentTable({ preview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Unidades en calle</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.units_in_street || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Valor en calle</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.street_sale_value_formatted || "-"}
          </p>
        </div>
        <div className="rounded-2xl border bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-600">Inversion</p>
          <p className="mt-2 text-lg font-semibold text-amber-900">
            {preview.summary?.investment_value_formatted || "-"}
          </p>
        </div>
        <div className="rounded-2xl border bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-rose-500">Pendiente</p>
          <p className="mt-2 text-lg font-semibold text-rose-900">
            {preview.summary?.street_balance_formatted || "-"}
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
              <tr key={`${row.product_id}-${row.seller_id}`} className="hover:bg-gray-50">
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

      {!preview.rows?.length ? (
        <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-600">
          No hay productos en calle para este filtro.
        </div>
      ) : null}
    </div>
  );
}

function PriceReviewTable({ preview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Productos</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {preview.summary?.products_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-rose-500">Riesgo contado</p>
          <p className="mt-2 text-lg font-semibold text-rose-900">
            {preview.summary?.cash_risk_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-600">Cambio proveedor</p>
          <p className="mt-2 text-lg font-semibold text-amber-900">
            {preview.summary?.supplier_change_count || 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-600">Ofertas</p>
          <p className="mt-2 text-lg font-semibold text-emerald-900">
            {preview.summary?.supplier_offer_count || 0}
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
              <tr key={row.product_id} className="hover:bg-gray-50">
                {(preview.columns || []).map((column) => {
                  const value = row[column.id] || "-";
                  const highlight =
                    column.id === "review_reason" && row.cash_price_risk_alert
                      ? "font-semibold text-rose-700"
                      : column.id === "review_reason" && row.supplier_change_alert
                        ? "font-semibold text-amber-700"
                        : "text-gray-700";

                  return (
                    <td key={column.id} className={`border-b p-3 ${highlight}`}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!preview.rows?.length ? (
        <div className="rounded-2xl border bg-emerald-50 p-4 text-sm text-emerald-900">
          No hay productos que coincidan con este filtro de revision.
        </div>
      ) : null}
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

  if (preview.viewType === "price_review") {
    return <PriceReviewTable preview={preview} />;
  }

  if (preview.viewType === "upcoming_payments") {
    return <UpcomingPaymentsTable preview={preview} />;
  }

  if (preview.viewType === "street_investment") {
    return <StreetInvestmentTable preview={preview} />;
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

export default function ReportsViewer({ initialReportApiName = "" }) {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filterDate, setFilterDate] = useState(getTodayDateInput());
  const [priceReviewMode, setPriceReviewMode] = useState("alerts");
  const [sellerOptions, setSellerOptions] = useState([]);
  const [sellerFilter, setSellerFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentDateFrom, setPaymentDateFrom] = useState("");
  const [paymentDateTo, setPaymentDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReportsData() {
      try {
        setLoading(true);
        const data = await getReports();
        if (!cancelled) {
          const activeReports = (data || []).filter((report) => report.isActive !== false);
          setReports(activeReports);
          const preferredReport = initialReportApiName
            ? activeReports.find((report) => report.apiName === initialReportApiName)
            : null;
          const nextReport = preferredReport || activeReports[0];

          if (nextReport) {
            setSelectedId(String(nextReport._id));
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
  }, [initialReportApiName]);

  useEffect(() => {
    let cancelled = false;

    async function loadSellerOptions() {
      try {
        const data = await getRecords("seller", {
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
          filters: JSON.stringify([{ field: "isactive", operator: "eq", value: true }]),
        });
        if (!cancelled) {
          setSellerOptions(data?.records || []);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadSellerOptions();
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
          selectedReport?.engine === "payments_by_day"
            ? { date: filterDate }
            : selectedReport?.engine === "price_review"
              ? { mode: priceReviewMode }
              : selectedReport?.engine === "upcoming_payments"
                ? {
                    sellerId: sellerFilter,
                    status: paymentStatusFilter,
                    dateFrom: paymentDateFrom,
                    dateTo: paymentDateTo,
                  }
                : selectedReport?.engine === "street_investment"
                  ? { sellerId: sellerFilter }
              : {};
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
  }, [
    selectedId,
    reports,
    filterDate,
    priceReviewMode,
    sellerFilter,
    paymentStatusFilter,
    paymentDateFrom,
    paymentDateTo,
  ]);

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
          {selectedReport?.engine === "price_review" ? (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Filtro</label>
                <select
                  className="rounded-lg border p-2"
                  value={priceReviewMode}
                  onChange={(event) => setPriceReviewMode(event.target.value)}
                >
                  <option value="alerts">Alertas activas</option>
                  <option value="risk">Solo riesgo contado</option>
                  <option value="change">Solo cambio proveedor</option>
                  <option value="offer">Solo ofertas proveedor</option>
                  <option value="all">Todos los productos</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">
                El reporte usa el mayorista proveedor y el precio detalle actual del producto.
              </p>
            </div>
          ) : null}
          {selectedReport?.engine === "upcoming_payments" ? (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Vendedor</label>
                <select
                  className="rounded-lg border p-2"
                  value={sellerFilter}
                  onChange={(event) => setSellerFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {sellerOptions.map((seller) => (
                    <option key={seller._id} value={seller._id}>
                      {seller.name || seller._id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Estado</label>
                <select
                  className="rounded-lg border p-2"
                  value={paymentStatusFilter}
                  onChange={(event) => setPaymentStatusFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="overdue">Vencidos</option>
                  <option value="week">Esta semana</option>
                  <option value="upcoming">Proximos</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Desde</label>
                <input
                  type="date"
                  className="rounded-lg border p-2"
                  value={paymentDateFrom}
                  onChange={(event) => setPaymentDateFrom(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Hasta</label>
                <input
                  type="date"
                  className="rounded-lg border p-2"
                  value={paymentDateTo}
                  onChange={(event) => setPaymentDateTo(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          {selectedReport?.engine === "street_investment" ? (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Vendedor</label>
                <select
                  className="rounded-lg border p-2"
                  value={sellerFilter}
                  onChange={(event) => setSellerFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {sellerOptions.map((seller) => (
                    <option key={seller._id} value={seller._id}>
                      {seller.name || seller._id}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-500">
                Se calcula con ventas con saldo pendiente y el costo guardado en cada item de venta.
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

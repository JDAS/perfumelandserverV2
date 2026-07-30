import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote,
  FilePlus2,
  Home,
  MessageCircle,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";
import LookupField from "../components/fields/LookupField";
import QuoteBuilderWorkspace from "../components/QuoteBuilderWorkspace";
import { useToast } from "../components/ui/ToastContext";
import {
  createRecord,
  getRecordById,
  getRecords,
  getSalePaymentSummary,
} from "../services/customService";
import { formatCRC } from "../utils/paymentCalculator";

const tabs = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "payment", label: "Cobrar", icon: Banknote },
  { id: "summary", label: "Resumen", icon: MessageCircle },
  { id: "quote", label: "Cotizar", icon: FilePlus2 },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function safeAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function SalePicker({ saleId, onSaleChange, selectedSale }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        Venta
      </p>
      <div className="mt-3">
        <LookupField
          field={{
            apiName: "sale_id",
            label: "Venta",
            type: "lookup",
            referenceTo: "sales",
          }}
          value={saleId}
          onChange={onSaleChange}
          formData={{}}
        />
      </div>
      {selectedSale ? (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">{selectedSale.name || "Venta"}</p>
          <p className="mt-1">
            Total {formatCRC(selectedSale.total)} · Pendiente{" "}
            {formatCRC(selectedSale.balance_due)}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    { label: "Total", value: summary.totalSaleFormatted },
    { label: "Pagado", value: summary.totalPaidFormatted },
    { label: "Pendiente", value: summary.balanceDueFormatted },
  ];

  if (summary.overdueTotal > 0) {
    cards.push({ label: "En mora", value: summary.overdueTotalFormatted, tone: "danger" });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border p-3 ${
            card.tone === "danger"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-950"
          }`}
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {card.label}
          </p>
          <p className="mt-2 text-lg font-black">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function SaleSummaryPanel({ saleId, selectedSale, summary, loading, onSaleChange, onRefresh }) {
  const { addToast } = useToast();
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (!summary?.whatsappText) return;

    try {
      setCopying(true);
      await navigator.clipboard.writeText(summary.whatsappText);
      addToast("Resumen copiado", "success");
    } catch (error) {
      console.error(error);
      addToast("No se pudo copiar el resumen", "error");
    } finally {
      setCopying(false);
    }
  };

  const handleWhatsApp = () => {
    if (!summary?.whatsappText) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(summary.whatsappText)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-4">
      <SalePicker saleId={saleId} onSaleChange={onSaleChange} selectedSale={selectedSale} />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Resumen para cliente
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {summary?.customerName || selectedSale?.name || "Selecciona una venta"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={!saleId || loading}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loading ? "..." : "Actualizar"}
          </button>
        </div>

        {summary ? (
          <div className="mt-4 space-y-4">
            <SummaryCards summary={summary} />

            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Perfumes
              </p>
              <div className="mt-2 space-y-2 text-sm text-slate-800">
                {summary.products?.map((product) => (
                  <div key={product.id} className="flex justify-between gap-3">
                    <span>{product.name}</span>
                    <strong>x{product.quantity}</strong>
                  </div>
                ))}
              </div>
            </div>

            {summary.overduePayments?.length ? (
              <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-900">
                <p className="font-bold">Cuotas vencidas</p>
                {summary.overduePayments.map((payment) => (
                  <p key={payment.id} className="mt-1">
                    Cuota {payment.number} · {payment.dueDate} ·{" "}
                    {payment.pendingAmountFormatted}
                  </p>
                ))}
              </div>
            ) : null}

            {summary.nextPayment ? (
              <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-bold">Proximo pago</p>
                <p className="mt-1">
                  Cuota {summary.nextPayment.number} · {summary.nextPayment.dueDate} ·{" "}
                  {summary.nextPayment.pendingAmountFormatted}
                </p>
              </div>
            ) : null}

            <textarea
              readOnly
              value={summary.whatsappText || ""}
              className="min-h-44 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopy}
                disabled={copying}
                className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {copying ? "Copiando..." : "Copiar"}
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"
              >
                WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Busca una venta para generar el resumen compacto.
          </p>
        )}
      </section>
    </div>
  );
}

function PaymentPanel({ saleId, selectedSale, summary, loadingSummary, onSaleChange, onSaved }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    date: todayInputValue(),
    payment_plan_id: "",
  });

  const pendingPayments = useMemo(() => summary?.payments || [], [summary]);
  const suggestedPayment = summary?.overduePayments?.[0] || summary?.nextPayment || null;

  useEffect(() => {
    if (!suggestedPayment) return;

    setForm((prev) => ({
      ...prev,
      amount: prev.amount || suggestedPayment.pendingAmount || "",
      payment_plan_id: prev.payment_plan_id || suggestedPayment.id || "",
    }));
  }, [suggestedPayment]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!saleId) {
      addToast("Selecciona una venta", "warning");
      return;
    }

    const amount = safeAmount(form.amount);
    if (amount <= 0) {
      addToast("El monto debe ser mayor a cero", "warning");
      return;
    }

    try {
      setSaving(true);
      await createRecord("payment", {
        sale_id: saleId,
        payment_plan_id: form.payment_plan_id || "",
        amount,
        date: form.date || todayInputValue(),
      });

      addToast("Pago registrado", "success");
      setForm({
        amount: "",
        date: todayInputValue(),
        payment_plan_id: "",
      });
      await onSaved?.();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo registrar el pago", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SalePicker saleId={saleId} onSaleChange={onSaleChange} selectedSale={selectedSale} />

      {summary ? <SummaryCards summary={summary} /> : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Registrar pago
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {selectedSale?.name || "Pago rapido"}
          </h2>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Cuota</span>
          <select
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3"
            value={form.payment_plan_id}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, payment_plan_id: event.target.value }))
            }
          >
            <option value="">Sin cuota especifica</option>
            {pendingPayments.map((payment) => (
              <option key={payment.id} value={payment.id}>
                Cuota {payment.number} · {payment.dueDate} ·{" "}
                {payment.pendingAmountFormatted}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Monto</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            className="mt-1 w-full rounded-2xl border border-slate-200 p-3 text-lg font-bold"
            value={form.amount}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amount: event.target.value }))
            }
            placeholder="11000"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Fecha</span>
          <input
            type="date"
            className="mt-1 w-full rounded-2xl border border-slate-200 p-3"
            value={form.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          />
        </label>

        {suggestedPayment ? (
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                amount: suggestedPayment.pendingAmount || "",
                payment_plan_id: suggestedPayment.id || "",
              }))
            }
            className="w-full rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
          >
            Usar sugerido: {suggestedPayment.pendingAmountFormatted}
          </button>
        ) : null}

        <button
          type="submit"
          disabled={saving || loadingSummary}
          className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar pago"}
        </button>
      </form>
    </div>
  );
}

function QuotePanel() {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Cotizacion
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-950">Crear cotizacion</h2>
      </div>
      <QuoteBuilderWorkspace compact />
    </section>
  );
}

function formatShortDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function SaleStatus({ sale }) {
  const isPaid = safeAmount(sale?.balance_due) <= 0;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide ${
        isPaid
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {isPaid ? "Pagada" : "Pendiente"}
    </span>
  );
}

function RecentSaleCard({ sale, onSelect, onOpenSummary }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <button type="button" onClick={() => onSelect(sale)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950">
              {sale.name || "Venta sin nombre"}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {formatShortDate(sale.saledate || sale.createdAt)}
            </p>
          </div>
          <SaleStatus sale={sale} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Total
            </p>
            <p className="mt-1 font-black text-slate-900">{formatCRC(sale.total)}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Pendiente
            </p>
            <p className="mt-1 font-black text-amber-700">
              {formatCRC(sale.balance_due)}
            </p>
          </div>
        </div>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => onSelect(sale)}
          className="rounded-2xl bg-slate-950 px-3 py-2.5 text-sm font-black text-white"
        >
          Registrar pago
        </button>
        <button
          type="button"
          onClick={() => onOpenSummary(sale)}
          className="rounded-2xl bg-slate-100 px-3 py-2.5 text-sm font-black text-slate-800"
        >
          Ver resumen
        </button>
      </div>
    </article>
  );
}

function MobileHome({
  recentSales,
  loading,
  onRefresh,
  onSelectSale,
  onOpenSummary,
  onOpenQuote,
}) {
  const totals = useMemo(
    () =>
      recentSales.reduce(
        (result, sale) => {
          result.sales += 1;
          result.pending += Math.max(safeAmount(sale.balance_due), 0);
          return result;
        },
        { sales: 0, pending: 0 }
      ),
    [recentSales]
  );

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-cyan-50 p-4 text-cyan-950">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-700">
            Ventas recientes
          </p>
          <p className="mt-2 text-3xl font-black">{totals.sales}</p>
        </div>
        <div className="rounded-3xl bg-amber-50 p-4 text-amber-950">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-amber-700">
            Pendiente
          </p>
          <p className="mt-2 text-xl font-black">{formatCRC(totals.pending)}</p>
        </div>
      </section>

      <section>
        <p className="px-1 text-xs font-black uppercase tracking-[0.22em] text-slate-500">
          Acciones rápidas
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link
            to="/admin/sales/new"
            className="flex min-h-28 flex-col justify-between rounded-3xl bg-slate-950 p-4 text-white shadow-lg"
          >
            <ReceiptText size={24} />
            <span className="text-base font-black">Nueva venta</span>
          </Link>
          <button
            type="button"
            onClick={onOpenQuote}
            className="flex min-h-28 flex-col justify-between rounded-3xl bg-cyan-500 p-4 text-left text-slate-950 shadow-lg"
          >
            <FilePlus2 size={24} />
            <span className="text-base font-black">Nueva cotización</span>
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Últimas ventas
            </p>
            <p className="mt-1 text-sm text-slate-500">Toca una venta para cobrarla.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar ventas"
            className="rounded-full border border-slate-200 bg-white p-3 text-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {recentSales.map((sale) => (
            <RecentSaleCard
              key={sale._id}
              sale={sale}
              onSelect={onSelectSale}
              onOpenSummary={onOpenSummary}
            />
          ))}
          {!loading && recentSales.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Search className="mx-auto text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">No hay ventas recientes.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MobileOpsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("home");
  const [saleId, setSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadRecentSales = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const response = await getRecords("sales", {
        page: 1,
        limit: 8,
        sortBy: "saledate",
        sortOrder: "desc",
        filters: JSON.stringify([
          { field: "status", operator: "eq", value: "Completada" },
        ]),
      });
      setRecentSales(response?.records || []);
    } catch (error) {
      console.error(error);
      addToast("No se pudieron cargar las ventas recientes", "error");
    } finally {
      setLoadingRecent(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadRecentSales();
  }, [loadRecentSales]);

  const loadSaleContext = async (nextSaleId, knownSale = null) => {
    if (!nextSaleId) {
      setSelectedSale(null);
      setSummary(null);
      return;
    }

    try {
      setLoadingSummary(true);
      const [saleRecord, saleSummary] = await Promise.all([
        knownSale || getRecordById("sales", nextSaleId),
        getSalePaymentSummary(nextSaleId),
      ]);

      setSelectedSale(saleRecord);
      setSummary(saleSummary);
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar la venta", "error");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSaleChange = async (nextSaleId) => {
    setSaleId(nextSaleId);
    await loadSaleContext(nextSaleId);
  };

  const refreshCurrentSale = async () => {
    await loadSaleContext(saleId);
    await loadRecentSales();
  };

  const openSale = async (sale, destination = "payment") => {
    setSaleId(String(sale._id));
    setSelectedSale(sale);
    setActiveTab(destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
    await loadSaleContext(String(sale._id), sale);
  };

  return (
    <div className="relative min-h-screen bg-slate-100 pb-28 sm:mx-auto sm:min-h-0 sm:max-w-lg sm:rounded-[2.5rem]">
      <header className="bg-slate-950 px-5 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] text-white shadow-xl sm:rounded-t-[2.5rem]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Vitra móvil
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black leading-tight">Operación</h1>
            <p className="mt-1 text-sm text-slate-300">
              Vende, cobra y atiende desde el teléfono.
            </p>
          </div>
          {selectedSale ? (
            <button
              type="button"
              onClick={() => setActiveTab("payment")}
              className="max-w-32 truncate rounded-full bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950"
            >
              {selectedSale.name || "Venta activa"}
            </button>
          ) : null}
        </div>
      </header>

      <main className="space-y-4 px-4 py-5">
        {activeTab === "home" ? (
          <MobileHome
            recentSales={recentSales}
            loading={loadingRecent}
            onRefresh={loadRecentSales}
            onSelectSale={(sale) => openSale(sale, "payment")}
            onOpenSummary={(sale) => openSale(sale, "summary")}
            onOpenQuote={() => setActiveTab("quote")}
          />
        ) : null}

        {activeTab === "payment" ? (
          <PaymentPanel
            saleId={saleId}
            selectedSale={selectedSale}
            summary={summary}
            loadingSummary={loadingSummary}
            onSaleChange={handleSaleChange}
            onSaved={refreshCurrentSale}
          />
        ) : null}

        {activeTab === "summary" ? (
          <SaleSummaryPanel
            saleId={saleId}
            selectedSale={selectedSale}
            summary={summary}
            loading={loadingSummary}
            onSaleChange={handleSaleChange}
            onRefresh={refreshCurrentSale}
          />
        ) : null}

        {activeTab === "quote" ? <QuotePanel /> : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(15,23,42,0.12)] backdrop-blur sm:absolute sm:rounded-b-[2.5rem]">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.68rem] font-black transition ${
                  active ? "bg-slate-950 text-white" : "text-slate-500"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.7 : 2} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default MobileOpsPage;

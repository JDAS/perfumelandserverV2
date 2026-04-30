import { useEffect, useMemo, useState } from "react";
import LookupField from "../components/fields/LookupField";
import QuoteBuilderWorkspace from "../components/QuoteBuilderWorkspace";
import { useToast } from "../components/ui/ToastContext";
import {
  createRecord,
  getRecordById,
  getSalePaymentSummary,
} from "../services/customService";
import { formatCRC } from "../utils/paymentCalculator";

const tabs = [
  { id: "payment", label: "Pago" },
  { id: "summary", label: "Resumen" },
  { id: "quote", label: "Cotizar" },
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
    <section className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Cotizacion
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-950">Crear cotizacion</h2>
      </div>
      <QuoteBuilderWorkspace />
    </section>
  );
}

function MobileOpsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("payment");
  const [saleId, setSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const loadSaleContext = async (nextSaleId) => {
    if (!nextSaleId) {
      setSelectedSale(null);
      setSummary(null);
      return;
    }

    try {
      setLoadingSummary(true);
      const [saleRecord, saleSummary] = await Promise.all([
        getRecordById("sales", nextSaleId),
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
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Vitra mobile
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight">
          Operacion rapida
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Pagos, resumen para cliente y cotizaciones desde el telefono.
        </p>
      </section>

      <nav className="sticky top-2 z-20 grid grid-cols-3 gap-2 rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-3 text-sm font-black transition ${
              activeTab === tab.id
                ? "bg-slate-950 text-white"
                : "text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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
    </div>
  );
}

export default MobileOpsPage;

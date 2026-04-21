import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, ClipboardList, RefreshCw } from "lucide-react";
import { useToast } from "../../ui/ToastContext";
import { getRecords } from "../../../services/customService";
import { adminTheme } from "../../../theme/adminTheme";
import { formatCRC, calculatePayments } from "../../../utils/paymentCalculator";

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return "-";

  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
}

function openWhatsappText(text) {
  const encoded = encodeURIComponent(text || "");
  window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
}

function SummaryAction({ label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value, tone = "default" }) {
  const tones = {
    default: { bg: adminTheme.surface, fg: adminTheme.text },
    alert: { bg: "#FEF2F2", fg: "#991B1B" },
    accent: { bg: adminTheme.surfaceAlt, fg: adminTheme.accentDeep },
  };

  const palette = tones[tone] || tones.default;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: palette.bg, borderColor: adminTheme.border }}
    >
      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: palette.fg }}>
        {value}
      </p>
    </div>
  );
}

function PanelShell({ icon, title, description, actions, children }) {
  const IconComponent = icon;

  return (
    <section
      className="rounded-3xl border p-5"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.accentDeep }}
          >
            <IconComponent className="h-5 w-5" strokeWidth={2.1} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: adminTheme.text }}>
              {title}
            </h3>
            <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
              {description}
            </p>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function PaymentStatusBadge({ kind }) {
  const styles =
    kind === "overdue"
      ? { backgroundColor: "#FEE2E2", color: "#991B1B" }
      : kind === "week"
        ? { backgroundColor: "#FEF3C7", color: "#92400E" }
        : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.accentDeep };

  const label = kind === "overdue" ? "Vencido" : kind === "week" ? "Esta semana" : "Próximo";

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
      style={styles}
    >
      {label}
    </span>
  );
}

function DraftStatusBadge({ label }) {
  const palette =
    label === "Sin productos"
      ? { backgroundColor: "#FEE2E2", color: "#991B1B" }
      : label === "Primer pago parcial"
        ? { backgroundColor: "#FEF3C7", color: "#92400E" }
        : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.accentDeep };

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
      style={palette}
    >
      {label}
    </span>
  );
}

function DataTable({ columns, rows, emptyLabel }) {
  if (!rows.length) {
    return (
      <div
        className="rounded-2xl border p-5 text-sm"
        style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border, color: adminTheme.muted }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: adminTheme.border }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ backgroundColor: adminTheme.surfaceAlt }}>
            {columns.map((column) => (
              <th
                key={column.id}
                className="border-b p-3 text-left font-semibold"
                style={{ borderColor: adminTheme.border, color: adminTheme.text }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className="border-b p-3"
                  style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                >
                  {column.render ? column.render(row) : row[column.id] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HomePanel({ salesObjectDef, onOpenSaleRecord }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sellerFilter, setSellerFilter] = useState("");
  const [dataset, setDataset] = useState({
    sellers: [],
    sales: [],
    paymentPlans: [],
    saleItems: [],
    partial: false,
  });

  const loadDashboard = useCallback(async () => {
    try {
      setRefreshing(true);

      const [sellerData, salesData, paymentPlanData, saleItemData] = await Promise.all([
        getRecords("seller", {
          page: 1,
          limit: 200,
          sortBy: "name",
          sortOrder: "asc",
          filters: JSON.stringify([{ field: "isactive", operator: "eq", value: true }]),
        }),
        getRecords("sales", {
          page: 1,
          limit: 500,
          sortBy: "saledate",
          sortOrder: "desc",
        }),
        getRecords("payment_plan", {
          page: 1,
          limit: 500,
          sortBy: "due_date",
          sortOrder: "asc",
        }),
        getRecords("sale_item", {
          page: 1,
          limit: 500,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      ]);

      setDataset({
        sellers: sellerData?.records || [],
        sales: salesData?.records || [],
        paymentPlans: paymentPlanData?.records || [],
        saleItems: saleItemData?.records || [],
        partial: Boolean(
          (salesData?.pagination?.total || 0) > (salesData?.records || []).length ||
            (paymentPlanData?.pagination?.total || 0) > (paymentPlanData?.records || []).length ||
            (saleItemData?.pagination?.total || 0) > (saleItemData?.records || []).length
        ),
      });
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar el tablero de inicio", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const salesById = useMemo(
    () => new Map((dataset.sales || []).map((sale) => [String(sale._id), sale])),
    [dataset.sales]
  );

  const itemCountBySale = useMemo(() => {
    const counts = new Map();
    for (const item of dataset.saleItems || []) {
      const saleId = normalizeId(item.sale);
      if (!saleId) continue;
      counts.set(saleId, (counts.get(saleId) || 0) + (Number(item.quantity) || 1));
    }
    return counts;
  }, [dataset.saleItems]);

  const today = useMemo(() => startOfToday(), []);

  const sellers = useMemo(() => dataset.sellers || [], [dataset.sellers]);

  const upcomingPayments = useMemo(() => {
    return (dataset.paymentPlans || [])
      .map((plan) => {
        const saleId = normalizeId(plan.sale_id);
        const sale = salesById.get(saleId);
        if (!sale) return null;

        const sellerId = normalizeId(sale.seller_id);
        if (sellerFilter && sellerId !== sellerFilter) return null;

        const dueDate = parseDate(plan.due_date);
        const remainingAmount = Number(plan.remaining_amount ?? plan.planned_amount ?? 0);
        if (!dueDate || remainingAmount <= 0) return null;
        if (String(plan.status || "").toLowerCase() === "paid") return null;

        const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
        const urgency = diffDays < 0 ? "overdue" : diffDays <= 7 ? "week" : "upcoming";

        return {
          id: String(plan._id),
          saleId,
          installmentNumber: Number(plan.installment_number) || 0,
          dueDate: plan.due_date,
          plannedAmount: Number(plan.planned_amount || 0),
          paidAmount: Number(plan.paid_amount || 0),
          remainingAmount,
          urgency,
          saleName: sale.name || `Venta ${String(saleId).slice(-6)}`,
          clientName: sale.client_id__label || sale.client_name || "Sin cliente",
          sellerName: sale.seller_id__label || "Sin vendedor",
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aDate = parseDate(a.dueDate)?.getTime() || 0;
        const bDate = parseDate(b.dueDate)?.getTime() || 0;
        return aDate - bDate;
      });
  }, [dataset.paymentPlans, salesById, sellerFilter, today]);

  const draftPendingRows = useMemo(() => {
    return (dataset.sales || [])
      .filter((sale) => String(sale.status || "").toLowerCase() === "borrador")
      .map((sale) => {
        const saleId = String(sale._id);
        const sellerId = normalizeId(sale.seller_id);
        if (sellerFilter && sellerId !== sellerFilter) return null;

        const itemsCount = itemCountBySale.get(saleId) || 0;
        const total = Number(sale.total || 0);
        const totalPaid = Number(sale.total_paid || 0);
        const preview = calculatePayments({
          total,
          type: sale.type,
          creditType: sale.credittype,
          quotes: sale.quotes,
          salesDate: sale.saledate,
        });
        const firstPayment = preview[0] || null;
        const firstExpectedAmount = Number(firstPayment?.expectedAmount || 0);
        const firstRemainingAmount = Math.max(firstExpectedAmount - totalPaid, 0);

        let draftState = "Primer pago pendiente";
        if (itemsCount <= 0) {
          draftState = "Sin productos";
        } else if (firstExpectedAmount > 0 && totalPaid > 0 && totalPaid < firstExpectedAmount) {
          draftState = "Primer pago parcial";
        }

        if (itemsCount > 0 && firstRemainingAmount <= 0 && firstExpectedAmount > 0) {
          return null;
        }

        return {
          id: saleId,
          saleId,
          saleName: sale.name || `Venta ${saleId.slice(-6)}`,
          clientName: sale.client_id__label || sale.client_name || "Sin cliente",
          sellerName: sale.seller_id__label || "Sin vendedor",
          itemsCount,
          total,
          totalPaid,
          firstPaymentDate: firstPayment?.fecha || "",
          firstExpectedAmount,
          firstRemainingAmount: itemsCount > 0 ? firstRemainingAmount : 0,
          draftState,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.itemsCount === 0 && b.itemsCount > 0) return -1;
        if (a.itemsCount > 0 && b.itemsCount === 0) return 1;
        return (b.firstRemainingAmount || 0) - (a.firstRemainingAmount || 0);
      });
  }, [dataset.sales, itemCountBySale, sellerFilter]);

  const upcomingSummaryText = useMemo(() => {
    const rows = upcomingPayments.slice(0, 12);
    const sellerLabel =
      sellers.find((seller) => String(seller._id) === sellerFilter)?.name || "Todos";

    const lines = [
      `Proximos pagos${sellerFilter ? ` · ${sellerLabel}` : ""}`,
      "",
    ];

    if (!rows.length) {
      lines.push("No hay pagos pendientes en este filtro.");
      return lines.join("\n");
    }

    rows.forEach((row) => {
      lines.push(
        `• ${row.clientName} | ${row.saleName} | Cuota ${row.installmentNumber || "-"} | ${formatDate(row.dueDate)} | ${formatCRC(row.remainingAmount)}`
      );
    });

    return lines.join("\n");
  }, [upcomingPayments, sellerFilter, sellers]);

  const draftSummaryText = useMemo(() => {
    const rows = draftPendingRows.slice(0, 12);
    const sellerLabel =
      sellers.find((seller) => String(seller._id) === sellerFilter)?.name || "Todos";

    const lines = [
      `Borradores pendientes${sellerFilter ? ` · ${sellerLabel}` : ""}`,
      "",
    ];

    if (!rows.length) {
      lines.push("No hay borradores pendientes con este filtro.");
      return lines.join("\n");
    }

    rows.forEach((row) => {
      if (row.itemsCount <= 0) {
        lines.push(`• ${row.clientName} | ${row.saleName} | Sin productos agregados`);
      } else {
        lines.push(
          `• ${row.clientName} | ${row.saleName} | Primer pago ${formatCRC(row.firstExpectedAmount)} | Pendiente ${formatCRC(row.firstRemainingAmount)} | ${formatDate(row.firstPaymentDate)}`
        );
      }
    });

    return lines.join("\n");
  }, [draftPendingRows, sellerFilter, sellers]);

  const upcomingMetrics = useMemo(() => {
    const overdue = upcomingPayments.filter((row) => row.urgency === "overdue").length;
    const week = upcomingPayments.filter((row) => row.urgency === "week").length;
    const total = upcomingPayments.reduce((sum, row) => sum + row.remainingAmount, 0);
    return { overdue, week, total };
  }, [upcomingPayments]);

  const draftMetrics = useMemo(() => {
    const withoutProducts = draftPendingRows.filter((row) => row.itemsCount <= 0).length;
    const withFirstPayment = draftPendingRows.filter((row) => row.itemsCount > 0).length;
    const totalPending = draftPendingRows.reduce((sum, row) => sum + row.firstRemainingAmount, 0);
    return { withoutProducts, withFirstPayment, totalPending };
  }, [draftPendingRows]);

  const handleCopySummary = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        addToast("Resumen copiado al portapapeles", "success");
      } catch (error) {
        console.error(error);
        addToast("No se pudo copiar el resumen", "error");
      }
    },
    [addToast]
  );

  const handleOpenWhatsappSummary = useCallback(
    (text) => {
      try {
        openWhatsappText(text);
      } catch (error) {
        console.error(error);
        addToast("No se pudo abrir WhatsApp", "error");
      }
    },
    [addToast]
  );

  const openSale = useCallback(
    (saleId) => {
      if (!onOpenSaleRecord || !salesObjectDef) return;
      const sale = salesById.get(String(saleId));
      if (!sale) return;
      onOpenSaleRecord(salesObjectDef, sale);
    },
    [onOpenSaleRecord, salesById, salesObjectDef]
  );

  const paymentColumns = useMemo(
    () => [
      {
        id: "sale",
        label: "Venta",
        render: (row) => (
          <button
            type="button"
            onClick={() => openSale(row.saleId)}
            className="text-left font-semibold underline-offset-2 hover:underline"
          >
            {row.saleName}
          </button>
        ),
      },
      { id: "client", label: "Cliente", render: (row) => row.clientName },
      { id: "seller", label: "Vendedor", render: (row) => row.sellerName },
      {
        id: "installment",
        label: "Cuota",
        render: (row) => (
          <div className="space-y-1">
            <p>#{row.installmentNumber || "-"}</p>
            <PaymentStatusBadge kind={row.urgency} />
          </div>
        ),
      },
      { id: "due", label: "Fecha", render: (row) => formatDate(row.dueDate) },
      { id: "remaining", label: "Pendiente", render: (row) => formatCRC(row.remainingAmount) },
    ],
    [openSale]
  );

  const draftColumns = useMemo(
    () => [
      {
        id: "sale",
        label: "Venta",
        render: (row) => (
          <button
            type="button"
            onClick={() => openSale(row.saleId)}
            className="text-left font-semibold underline-offset-2 hover:underline"
          >
            {row.saleName}
          </button>
        ),
      },
      { id: "client", label: "Cliente", render: (row) => row.clientName },
      { id: "seller", label: "Vendedor", render: (row) => row.sellerName },
      {
        id: "state",
        label: "Estado",
        render: (row) => (
          <div className="space-y-1">
            <DraftStatusBadge label={row.draftState} />
            <p className="text-xs" style={{ color: adminTheme.muted }}>
              {row.itemsCount} producto(s)
            </p>
          </div>
        ),
      },
      { id: "total", label: "Total actual", render: (row) => formatCRC(row.total) },
      {
        id: "first",
        label: "Primer pago",
        render: (row) =>
          row.itemsCount <= 0 ? (
            <span style={{ color: adminTheme.muted }}>Falta agregar productos</span>
          ) : (
            <div>
              <p>{formatCRC(row.firstExpectedAmount)}</p>
              <p className="text-xs" style={{ color: adminTheme.muted }}>
                {formatDate(row.firstPaymentDate)}
              </p>
            </div>
          ),
      },
      {
        id: "pending",
        label: "Pendiente",
        render: (row) =>
          row.itemsCount <= 0 ? "-" : formatCRC(row.firstRemainingAmount),
      },
    ],
    [openSale]
  );

  return (
    <div className="space-y-5">
      <section
        className="rounded-3xl border p-5"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em]" style={{ color: adminTheme.muted }}>
              Inicio operativo
            </p>
            <h3 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.text }}>
              Pendientes comerciales y de cobro
            </h3>
            <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
              Vista rápida para seguimiento por vendedor, próximos pagos y ventas en borrador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sellerFilter}
              onChange={(event) => setSellerFilter(event.target.value)}
              className="rounded-xl border px-4 py-2 text-sm outline-none"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              <option value="">Todos los vendedores</option>
              {sellers.map((seller) => (
                <option key={seller._id} value={seller._id}>
                  {seller.name || seller._id}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadDashboard}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2} />
              {refreshing ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>

        {dataset.partial ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm"
            style={{ backgroundColor: "#FEF3C7", borderColor: "#FCD34D", color: "#92400E" }}
          >
            Este corte puede ser parcial si hay más de 500 ventas, cuotas o items. Sirve como
            tablero operativo rápido, no como auditoría completa.
          </div>
        ) : null}
      </section>

      {loading ? (
        <div
          className="rounded-3xl border p-6 text-sm"
          style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border, color: adminTheme.muted }}
        >
          Cargando inicio operativo...
        </div>
      ) : (
        <>
          <PanelShell
            icon={CalendarClock}
            title="Próximos pagos"
            description="Cuotas pendientes por cobrar, con foco en vencidos y pagos de esta semana."
            actions={
              <>
                <SummaryAction
                  label="Copiar resumen"
                  onClick={() => handleCopySummary(upcomingSummaryText)}
                  disabled={!upcomingPayments.length}
                />
                <SummaryAction
                  label="WhatsApp"
                  onClick={() => handleOpenWhatsappSummary(upcomingSummaryText)}
                  disabled={!upcomingPayments.length}
                />
              </>
            }
          >
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <MetricCard label="Vencidos" value={upcomingMetrics.overdue} tone="alert" />
              <MetricCard label="Esta semana" value={upcomingMetrics.week} tone="accent" />
              <MetricCard label="Pendiente total" value={formatCRC(upcomingMetrics.total)} />
            </div>

            <DataTable
              columns={paymentColumns}
              rows={upcomingPayments.slice(0, 18)}
              emptyLabel="No hay cuotas pendientes para este filtro."
            />
          </PanelShell>

          <PanelShell
            icon={ClipboardList}
            title="Borradores pendientes"
            description="Ventas en borrador que todavía no tienen productos o siguen sin cubrir el primer pago esperado."
            actions={
              <>
                <SummaryAction
                  label="Copiar resumen"
                  onClick={() => handleCopySummary(draftSummaryText)}
                  disabled={!draftPendingRows.length}
                />
                <SummaryAction
                  label="WhatsApp"
                  onClick={() => handleOpenWhatsappSummary(draftSummaryText)}
                  disabled={!draftPendingRows.length}
                />
              </>
            }
          >
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <MetricCard label="Sin productos" value={draftMetrics.withoutProducts} tone="alert" />
              <MetricCard label="Con primer pago pendiente" value={draftMetrics.withFirstPayment} tone="accent" />
              <MetricCard label="Primer pago total pendiente" value={formatCRC(draftMetrics.totalPending)} />
            </div>

            <DataTable
              columns={draftColumns}
              rows={draftPendingRows.slice(0, 18)}
              emptyLabel="No hay borradores pendientes para este filtro."
            />
          </PanelShell>
        </>
      )}
    </div>
  );
}

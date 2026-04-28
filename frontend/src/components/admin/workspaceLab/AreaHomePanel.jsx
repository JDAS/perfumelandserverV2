import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  ClipboardList,
  Megaphone,
  RefreshCw,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useToast } from "../../ui/ToastContext";
import { getRecords } from "../../../services/customService";
import { adminTheme } from "../../../theme/adminTheme";
import { formatCRC } from "../../../utils/paymentCalculator";
import { HomePanel } from "./HomePanel";
import { DataTable, MetricCard, PanelShell } from "./HomePanelParts";

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
}

function getLookupLabel(record, fieldApiName) {
  return record?._lookup?.[fieldApiName]?.label || "";
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

function HomeHeader({ eyebrow, title, description, refreshing, onRefresh }) {
  return (
    <section
      className="rounded-3xl border p-5"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: adminTheme.muted }}>
            {eyebrow}
          </p>
          <h3 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.text }}>
            {title}
          </h3>
          <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
            {description}
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ToolButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-sm font-semibold"
      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
    >
      {children}
    </button>
  );
}

function LoadingState({ label }) {
  return (
    <div
      className="rounded-3xl border p-6 text-sm"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border, color: adminTheme.muted }}
    >
      {label}
    </div>
  );
}

function CatalogHome({ onOpenSystemTool }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataset, setDataset] = useState({
    marginRisk: [],
    supplierChanges: [],
    offers: [],
    pendingItems: [],
    totals: {
      marginRisk: 0,
      supplierChanges: 0,
      offers: 0,
      pending: 0,
    },
  });

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [marginRiskData, supplierChangeData, offerData, pendingItemData] = await Promise.all([
        getRecords("product", {
          page: 1,
          limit: 100,
          sortBy: "updatedAt",
          sortOrder: "desc",
          filters: JSON.stringify([{ field: "cash_price_risk_alert", operator: "eq", value: true }]),
        }),
        getRecords("product", {
          page: 1,
          limit: 100,
          sortBy: "updatedAt",
          sortOrder: "desc",
          filters: JSON.stringify([{ field: "supplier_change_alert", operator: "eq", value: true }]),
        }),
        getRecords("product", {
          page: 1,
          limit: 100,
          sortBy: "updatedAt",
          sortOrder: "desc",
          filters: JSON.stringify([{ field: "supplier_is_offer", operator: "eq", value: true }]),
        }),
        getRecords("quote_item", {
          page: 1,
          limit: 100,
          sortBy: "updatedAt",
          sortOrder: "desc",
          filters: JSON.stringify([{ field: "pending_catalog_completion", operator: "eq", value: true }]),
        }),
      ]);
      setDataset({
        marginRisk: marginRiskData?.records || [],
        supplierChanges: supplierChangeData?.records || [],
        offers: offerData?.records || [],
        pendingItems: pendingItemData?.records || [],
        totals: {
          marginRisk: marginRiskData?.pagination?.total || marginRiskData?.total || 0,
          supplierChanges: supplierChangeData?.pagination?.total || supplierChangeData?.total || 0,
          offers: offerData?.pagination?.total || offerData?.total || 0,
          pending: pendingItemData?.pagination?.total || pendingItemData?.total || 0,
        },
      });
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar el inicio de catalogo", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    const productsById = new Map();
    for (const product of [...dataset.marginRisk, ...dataset.supplierChanges, ...dataset.offers]) {
      productsById.set(String(product._id), product);
    }

    const productRows = [...productsById.values()].map((product) => {
        const wholesale = parseNumber(product.supplier_last_wholesale_price || product.legacyWholesalePrice);
        const detail = parseNumber(product.price);
        const margin = detail && wholesale ? detail - wholesale : 0;
        const alerts = [
          product.cash_price_risk_alert ? "Margen bajo" : "",
          product.supplier_change_alert ? "Cambio proveedor" : "",
          product.supplier_is_offer ? "Oferta" : "",
          product.pending_catalog_completion ? "Completar catalogo" : "",
        ].filter(Boolean);

        return {
          id: product._id,
          type: "Producto",
          name: product.name || product.product_name || product._id,
          detail,
          wholesale,
          margin,
          alerts: alerts.join(", "),
        };
      });

    const pendingRows = dataset.pendingItems.map((item) => ({
      id: item._id,
      type: "Cotizacion",
      name: item.manual_product_name || getLookupLabel(item, "product") || "Producto manual",
      detail: parseNumber(item.price),
      wholesale: 0,
      margin: 0,
      alerts: "Completar catalogo",
    }));

    return [...productRows, ...pendingRows];
  }, [dataset]);

  const columns = useMemo(
    () => [
      { id: "type", label: "Origen" },
      { id: "name", label: "Producto" },
      { id: "alerts", label: "Alerta" },
      { id: "wholesale", label: "Mayorista", render: (row) => (row.wholesale ? formatCRC(row.wholesale) : "-") },
      { id: "detail", label: "Detalle", render: (row) => (row.detail ? formatCRC(row.detail) : "-") },
      { id: "margin", label: "Diferencia", render: (row) => (row.margin ? formatCRC(row.margin) : "-") },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <HomeHeader
        eyebrow="Inicio catalogo"
        title="Revision rapida de precios y productos"
        description="Prioriza margen contado, cambios del proveedor, ofertas y productos manuales por completar."
        refreshing={refreshing}
        onRefresh={loadData}
      />
      {loading ? (
        <LoadingState label="Cargando inicio de catalogo..." />
      ) : (
        <PanelShell
          icon={Boxes}
          title="Alertas de catalogo"
          description="Este corte usa los productos recientes para orientar que revisar primero."
          actions={<ToolButton onClick={() => onOpenSystemTool?.("priceReview")}>Abrir revision de precios</ToolButton>}
        >
          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <MetricCard label="Margen bajo" value={dataset.totals.marginRisk} tone="alert" />
            <MetricCard label="Cambio proveedor" value={dataset.totals.supplierChanges} tone="accent" />
            <MetricCard label="Ofertas" value={dataset.totals.offers} />
            <MetricCard label="Por completar" value={dataset.totals.pending} tone="accent" />
          </div>
          <DataTable
            columns={columns}
            rows={rows.slice(0, 18)}
            emptyLabel="No hay alertas recientes de catalogo en este corte."
          />
        </PanelShell>
      )}
    </div>
  );
}

function FinanceHome({ onOpenSystemTool }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getRecords("payment_plan", {
        page: 1,
        limit: 100,
        sortBy: "due_date",
        sortOrder: "asc",
        filters: JSON.stringify([
          { field: "status", operator: "ne", value: "Paid" },
          { field: "remaining_amount", operator: "gt", value: 0 },
        ]),
      });
      setPlans(data?.records || []);
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar el inicio financiero", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const rows = useMemo(
    () =>
      plans.map((plan) => {
        const dueTime = new Date(plan.due_date || "").getTime();
        const diffDays = Number.isFinite(dueTime) ? Math.floor((dueTime - today) / 86400000) : 999;
        return {
          id: plan._id,
          sale: getLookupLabel(plan, "sale_id") || normalizeId(plan.sale_id) || "-",
          installment: plan.installment_number || "-",
          dueDate: plan.due_date,
          remaining: parseNumber(plan.remaining_amount || plan.planned_amount),
          status: diffDays < 0 ? "Vencido" : diffDays <= 7 ? "Esta semana" : "Pendiente",
        };
      }),
    [plans, today]
  );

  const metrics = useMemo(
    () => ({
      overdue: rows.filter((row) => row.status === "Vencido").length,
      week: rows.filter((row) => row.status === "Esta semana").length,
      total: rows.reduce((sum, row) => sum + row.remaining, 0),
    }),
    [rows]
  );

  const columns = useMemo(
    () => [
      { id: "sale", label: "Venta" },
      { id: "installment", label: "Cuota" },
      { id: "status", label: "Estado" },
      { id: "dueDate", label: "Fecha", render: (row) => formatDate(row.dueDate) },
      { id: "remaining", label: "Pendiente", render: (row) => formatCRC(row.remaining) },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <HomeHeader
        eyebrow="Inicio finanzas"
        title="Cobros y cuotas pendientes"
        description="Una vista enfocada solo en cuotas abiertas para revisar vencidos y cobros cercanos."
        refreshing={refreshing}
        onRefresh={loadData}
      />
      {loading ? (
        <LoadingState label="Cargando inicio financiero..." />
      ) : (
        <PanelShell
          icon={BadgeDollarSign}
          title="Plan de pago"
          description="Cuotas no pagadas ordenadas por fecha."
          actions={<ToolButton onClick={() => onOpenSystemTool?.("reports")}>Abrir reportes</ToolButton>}
        >
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <MetricCard label="Vencidas" value={metrics.overdue} tone="alert" />
            <MetricCard label="Esta semana" value={metrics.week} tone="accent" />
            <MetricCard label="Pendiente total" value={formatCRC(metrics.total)} />
          </div>
          <DataTable columns={columns} rows={rows.slice(0, 18)} emptyLabel="No hay cuotas pendientes." />
        </PanelShell>
      )}
    </div>
  );
}

function CampaignHome({ onOpenSystemTool }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataset, setDataset] = useState({ campaigns: [], links: [], entries: [] });

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [campaigns, links, entries] = await Promise.all([
        getRecords("campaign", {
          page: 1,
          limit: 50,
          sortBy: "end_date",
          sortOrder: "asc",
          filters: JSON.stringify([{ field: "status", operator: "eq", value: "Activa" }]),
        }),
        getRecords("campaign_sale_link", {
          page: 1,
          limit: 100,
          sortBy: "sale_date",
          sortOrder: "desc",
          filters: JSON.stringify([{ field: "status", operator: "eq", value: "Activa" }]),
        }),
        getRecords("campaign_entry", {
          page: 1,
          limit: 100,
          sortBy: "assigned_at",
          sortOrder: "desc",
          filters: JSON.stringify([{ field: "status", operator: "eq", value: "Activa" }]),
        }),
      ]);
      setDataset({
        campaigns: campaigns?.records || [],
        links: links?.records || [],
        entries: entries?.records || [],
      });
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar el inicio de campanas", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const entryCountByCampaignSale = useMemo(() => {
    const counts = new Map();
    for (const entry of dataset.entries) {
      const key = `${normalizeId(entry.campaign_id)}:${normalizeId(entry.sale_id)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [dataset.entries]);

  const rows = useMemo(
    () =>
      dataset.links.map((link) => {
        const key = `${normalizeId(link.campaign_id)}:${normalizeId(link.sale_id)}`;
        return {
          id: link._id,
          campaign: getLookupLabel(link, "campaign_id") || normalizeId(link.campaign_id) || "-",
          sale: getLookupLabel(link, "sale_id") || normalizeId(link.sale_id) || "-",
          participant:
            link.participant_name ||
            getLookupLabel(link, "participant_id") ||
            normalizeId(link.participant_id) ||
            "-",
          entries: entryCountByCampaignSale.get(key) || "-",
        };
      }),
    [dataset.links, entryCountByCampaignSale]
  );

  const columns = useMemo(
    () => [
      { id: "campaign", label: "Campana" },
      { id: "sale", label: "Venta" },
      { id: "participant", label: "Participante" },
      { id: "entries", label: "Numeros" },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <HomeHeader
        eyebrow="Inicio campanas"
        title="Participaciones y ventas vinculadas"
        description="Control rapido para validar campanas activas, compras participantes y numeros generados."
        refreshing={refreshing}
        onRefresh={loadData}
      />
      {loading ? (
        <LoadingState label="Cargando inicio de campanas..." />
      ) : (
        <PanelShell
          icon={Megaphone}
          title="Estado de campanas"
          description="Ultimos vinculos de ventas con campanas y volumen reciente de numeros."
          actions={<ToolButton onClick={() => onOpenSystemTool?.("reports")}>Abrir reportes</ToolButton>}
        >
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <MetricCard label="Activas" value={dataset.campaigns.length} tone="accent" />
            <MetricCard label="Ventas vinculadas" value={dataset.links.length} />
            <MetricCard label="Numeros recientes" value={dataset.entries.length} />
          </div>
          <DataTable columns={columns} rows={rows.slice(0, 18)} emptyLabel="No hay ventas vinculadas recientes." />
        </PanelShell>
      )}
    </div>
  );
}

function OperationsHome({ onOpenSystemTool }) {
  return (
    <div className="space-y-5">
      <HomeHeader
        eyebrow="Inicio operacion"
        title="Automatizaciones y pruebas"
        description="Entrada rapida para validar flows, tester y tableros operativos sin tocar produccion."
      />
      <PanelShell
        icon={Workflow}
        title="Flow builder"
        description="El objeto tester queda como laboratorio para probar condiciones, updates y creacion de registros relacionados."
        actions={<ToolButton onClick={() => onOpenSystemTool?.("dashboards")}>Abrir dashboards</ToolButton>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Objeto prueba" value="tester" tone="accent" />
          <MetricCard label="Log relacionado" value="tester_log" />
          <MetricCard label="Motor" value="Activo" />
        </div>
      </PanelShell>
    </div>
  );
}

function PeopleHome({ onOpenSystemTool }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataset, setDataset] = useState({ clients: [], sellers: [] });

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [clients, sellers] = await Promise.all([
        getRecords("client", { page: 1, limit: 100, sortBy: "updatedAt", sortOrder: "desc" }),
        getRecords("seller", { page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
      ]);
      setDataset({ clients: clients?.records || [], sellers: sellers?.records || [] });
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar el inicio de clientes", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(
    () =>
      dataset.clients.slice(0, 18).map((client) => ({
        id: client._id,
        name: client.name || client.full_name || client._id,
        phone: client.phone || client.whatsapp || "-",
        updated: client.updatedAt || client.createdAt,
      })),
    [dataset.clients]
  );

  const columns = useMemo(
    () => [
      { id: "name", label: "Cliente" },
      { id: "phone", label: "Telefono" },
      { id: "updated", label: "Actualizado", render: (row) => formatDate(row.updated) },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <HomeHeader
        eyebrow="Inicio clientes"
        title="Clientes y vendedores"
        description="Vista ligera para revisar actividad reciente y equipo comercial."
        refreshing={refreshing}
        onRefresh={loadData}
      />
      {loading ? (
        <LoadingState label="Cargando inicio de clientes..." />
      ) : (
        <PanelShell
          icon={UsersRound}
          title="Actividad reciente"
          description="Ultimos clientes actualizados y cantidad de vendedores disponibles."
          actions={<ToolButton onClick={() => onOpenSystemTool?.("reports")}>Abrir reportes</ToolButton>}
        >
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <MetricCard label="Clientes recientes" value={dataset.clients.length} tone="accent" />
            <MetricCard label="Vendedores" value={dataset.sellers.length} />
            <MetricCard label="Vista" value="CRM" />
          </div>
          <DataTable columns={columns} rows={rows} emptyLabel="No hay clientes recientes en este corte." />
        </PanelShell>
      )}
    </div>
  );
}

export function AreaHomePanel({ areaId, salesObjectDef, onOpenSaleRecord, onOpenSystemTool }) {
  if (areaId === "catalog") return <CatalogHome onOpenSystemTool={onOpenSystemTool} />;
  if (areaId === "finance") return <FinanceHome onOpenSystemTool={onOpenSystemTool} />;
  if (areaId === "campaigns") return <CampaignHome onOpenSystemTool={onOpenSystemTool} />;
  if (areaId === "operations") return <OperationsHome onOpenSystemTool={onOpenSystemTool} />;
  if (areaId === "people") return <PeopleHome onOpenSystemTool={onOpenSystemTool} />;

  return <HomePanel salesObjectDef={salesObjectDef} onOpenSaleRecord={onOpenSaleRecord} />;
}

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  FileText,
  BadgeCheck,
  ChartColumn,
  CreditCard,
  Pencil,
  Eye,
  LayoutDashboard,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import QuoteBuilderModal from "../components/admin/QuoteBuilderModal";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ReportsViewer from "../components/admin/ReportsViewer";
import {
  BadgeChip,
  ClassicTab,
  LauncherChip,
  QuickActionButton,
  WorkspaceHeader,
} from "../components/admin/workspaceLab/WorkspaceChrome";
import {
  CreateRecordModal,
  EditRecordPanel,
} from "../components/admin/workspaceLab/RecordForms";
import { ListPanel } from "../components/admin/workspaceLab/ListPanel";
import { RecordDetailPanel } from "../components/admin/workspaceLab/RecordDetailPanel";
import ClientSummaryModal from "../components/ClientSummaryModal";
import Pagination from "../components/ui/Pagination";
import { useToast } from "../components/ui/ToastContext";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getLookupDisplayData,
  getDefaultListView,
  getListColumns,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../engine/metadataEngine";
import {
  convertQuoteToSale,
  deleteRecord,
  getClientSummary,
  getRecordById,
  getRecords,
  getRelatedRecords,
  syncSaleCampaigns,
  updateRecord,
} from "../services/customService";
import { useAuthStore } from "../store/authStore";
import { adminTheme } from "../theme/adminTheme";

const STORAGE_PREFIX = "admin-workspace-lab-v2";
const HOME_TAB_ID = "home:financial-report";
const REPORTS_TAB_ID = "reports:viewer";
const DASHBOARDS_TAB_ID = "dashboards:viewer";

function readState(key) {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      activeObjectApi: typeof parsed?.activeObjectApi === "string" ? parsed.activeObjectApi : "",
      activeTabId: typeof parsed?.activeTabId === "string" ? parsed.activeTabId : "",
      tabs: Array.isArray(parsed?.tabs) ? parsed.tabs : [],
    };
  } catch {
    return null;
  }
}

function writeState(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

function listTabId(objectApi) {
  return `list:${objectApi}`;
}

function recordTabId(objectApi, recordId) {
  return `record:${objectApi}:${recordId}`;
}

function childSubtabId(objectApi, recordId) {
  return `child:${objectApi}:${recordId}`;
}

function makeHomeTab() {
  return {
    id: HOME_TAB_ID,
    type: "home",
    objectApi: "",
    label: "Inicio",
    pinned: true,
  };
}

function makeReportsTab() {
  return {
    id: REPORTS_TAB_ID,
    type: "reports",
    objectApi: "",
    label: "Reportes",
    pinned: false,
  };
}

function makeDashboardsTab() {
  return {
    id: DASHBOARDS_TAB_ID,
    type: "dashboards",
    objectApi: "",
    label: "Dashboards",
    pinned: false,
  };
}

function getRecordLabel(record, objectDef) {
  const directKeys = [
    "name",
    "title",
    "product_name",
    "customer_name",
    "client_name",
    "participant_name",
    "brand",
  ];

  for (const key of directKeys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const field of objectDef?.fields || []) {
    const formatted = formatFieldValue(field, record?.[field.apiName], record);
    if (formatted && formatted !== "-") {
      return formatted;
    }
  }

  return `${objectDef?.name || "Registro"} ${String(record?._id || "").slice(-6)}`;
}

function makeListTab(objectDef) {
  return {
    id: listTabId(objectDef.apiName),
    type: "list",
    objectApi: objectDef.apiName,
    label: objectDef.name,
    pinned: false,
  };
}

function makeRecordTab(record, objectDef) {
  return {
    id: recordTabId(objectDef.apiName, record._id),
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: getRecordLabel(record, objectDef),
    pinned: false,
    refreshKey: 0,
    activeSubtabId: "detail",
    subtabs: [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
  };
}

function makeRecordTabFromLookup({ objectApi, recordId, label, objectDef }) {
  return {
    id: recordTabId(objectApi, recordId),
    type: "record",
    objectApi,
    recordId,
    label: label || `${objectDef?.name || "Registro"} ${String(recordId || "").slice(-6)}`,
    pinned: false,
    refreshKey: 0,
    activeSubtabId: "detail",
    subtabs: [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
  };
}

function makeChildSubtab(record, objectDef) {
  return {
    id: childSubtabId(objectDef.apiName, record._id),
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: `${objectDef.name}: ${getRecordLabel(record, objectDef)}`,
    pinned: false,
  };
}

function makeEditSubtab() {
  return {
    id: "edit",
    type: "edit",
    label: "Editar",
    pinned: false,
  };
}


function _WorkspaceHeaderLegacy({ activeTab, levelThreeAvailable }) {
  const title =
    activeTab?.type === "home"
      ? "Inicio"
      : activeTab?.type === "list"
        ? `${activeTab.label} · Lista`
        : `${activeTab?.label || "Registro abierto"}`;

  const description =
    activeTab?.type === "home"
      ? "Tab fijo de arranque. Por ahora muestra el reporte financiero."
      : activeTab?.type === "list"
        ? "La lista vive en nivel 2 y desde aqui puedes abrir registros de cualquier objeto."
        : "Los relacionados del registro activo viven como badges en nivel 3 dentro del mismo contexto.";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
          Area de trabajo
        </p>
        <h2 className="mt-1 text-xl font-semibold" style={{ color: adminTheme.text }}>
          {title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
          {description}
        </p>
      </div>

      {levelThreeAvailable ? (
        <div
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted }}
        >
          Nivel 3 disponible
        </div>
      ) : null}
    </div>
  );
}

function formatFilterLabel(filter, objectDef) {
  if (!filter?.field) return "Filtro";

  const field = (objectDef?.fields || []).find((item) => item.apiName === filter.field);
  const fieldLabel = field?.label || filter.field;
  const operatorMap = {
    eq: "=",
    ne: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    contains: "contiene",
    in: "incluye",
  };

  return `${fieldLabel} ${operatorMap[filter.operator] || filter.operator || "="} ${String(
    filter.value ?? ""
  )}`;
}

function ListPanelLegacy({ objectDef, onOpenRecord, onOpenEditRecord, onOpenLookupRecord }) {
  const { addToast } = useToast();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuoteBuilderModal, setShowQuoteBuilderModal] = useState(false);
  const [convertingQuoteId, setConvertingQuoteId] = useState(null);
  const [syncingCampaignId, setSyncingCampaignId] = useState(null);
  const [markingCommissionId, setMarkingCommissionId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoadingId, setSummaryLoadingId] = useState(null);
  const [copying, setCopying] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const listView = useMemo(() => getDefaultListView(objectDef), [objectDef]);
  const createInitialValues = useMemo(() => ({}), []);
  const [viewApiName, setViewApiName] = useState(listView?.apiName || "");
  const currentView = useMemo(
    () =>
      (objectDef?.listViews || []).find((view) => view.apiName === viewApiName) || listView,
    [listView, objectDef?.listViews, viewApiName]
  );
  const columns = useMemo(
    () => getListColumns(objectDef, currentView).slice(0, 6),
    [currentView, objectDef]
  );
  const activeFilters = useMemo(() => currentView?.filters || [], [currentView?.filters]);

  useEffect(() => {
    setViewApiName(listView?.apiName || "");
  }, [listView?.apiName]);

  useEffect(() => {
    setSortBy(currentView?.sortBy || "createdAt");
    setSortOrder(currentView?.sortOrder || "desc");
    setPage(1);
  }, [currentView?.apiName, currentView?.sortBy, currentView?.sortOrder]);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRecords(objectDef.apiName, {
        page,
        limit: 12,
        search: searchTerm,
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "desc",
        filters: JSON.stringify(activeFilters),
      });
      setRecords(data?.records || []);
      setPagination(
        data?.pagination || {
          page: data?.page || page,
          pages: data?.pages || 1,
          total: data?.total || 0,
          limit: data?.limit || 12,
        }
      );
    } catch {
      setRecords([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [activeFilters, objectDef.apiName, page, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        const data = await getRecords(objectDef.apiName, {
          page,
          limit: 12,
          search: searchTerm,
          sortBy: sortBy || "createdAt",
          sortOrder: sortOrder || "desc",
          filters: JSON.stringify(activeFilters),
        });
        if (cancelled) return;
        setRecords(data?.records || []);
        setPagination(
          data?.pagination || {
            page: data?.page || page,
            pages: data?.pages || 1,
            total: data?.total || 0,
            limit: data?.limit || 12,
          }
        );
      } catch {
        if (cancelled) return;
        setRecords([]);
        setPagination(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeFilters, objectDef.apiName, page, searchTerm, sortBy, sortOrder]);

  const handleApplySearch = () => {
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleSort = (fieldApiName) => {
    const sameField = sortBy === fieldApiName;
    setPage(1);
    setSortBy(fieldApiName);
    setSortOrder(sameField && sortOrder === "asc" ? "desc" : "asc");
  };

  const supportsClientSummary =
    objectDef.apiName === "sales" || objectDef.apiName === "quote";

  const handleConvertQuote = async (record) => {
    if (!record?._id || record.status === "Convertida") return;

    try {
      setConvertingQuoteId(record._id);
      const result = await convertQuoteToSale(record._id);
      addToast("Cotizacion convertida en venta", "success");
      if (result?.saleId) {
        onOpenLookupRecord({
          objectApi: "sales",
          recordId: result.saleId,
          label: "Venta convertida",
          isLinkable: true,
        });
      }
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo convertir la cotizacion", "error");
    } finally {
      setConvertingQuoteId(null);
    }
  };

  const handleDelete = async (recordId) => {
    if (!recordId) return;
    if (!window.confirm("¿Eliminar este registro?")) return;

    try {
      await deleteRecord(objectDef.apiName, recordId);
      addToast("Registro eliminado", "success");
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo eliminar el registro", "error");
    }
  };

  const handleOpenSummary = async (recordId) => {
    if (!recordId) return;

    try {
      setSummaryLoadingId(recordId);
      const data = await getClientSummary(objectDef.apiName, recordId);
      setSummary(data);
      setSummaryOpen(true);
    } catch (error) {
      console.error(error);
      addToast("No se pudo generar el resumen", "error");
    } finally {
      setSummaryLoadingId(null);
    }
  };

  const handleCopySummary = async () => {
    if (!summary?.whatsappText) return;

    try {
      setCopying(true);
      await navigator.clipboard.writeText(summary.whatsappText);
      addToast("Resumen copiado al portapapeles", "success");
    } catch (error) {
      console.error(error);
      addToast("No se pudo copiar el resumen", "error");
    } finally {
      setCopying(false);
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!summary?.whatsappText) return;

    try {
      setOpeningWhatsApp(true);
      const encoded = encodeURIComponent(summary.whatsappText);
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      addToast("No se pudo abrir WhatsApp", "error");
    } finally {
      setOpeningWhatsApp(false);
    }
  };

  const handleSyncCampaigns = async (recordId) => {
    if (!recordId) return;

    try {
      setSyncingCampaignId(recordId);
      await syncSaleCampaigns(recordId);
      addToast("Promo evaluada", "success");
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo evaluar la promo", "error");
    } finally {
      setSyncingCampaignId(null);
    }
  };

  const handleMarkCommissionPaid = async (record) => {
    if (!record?._id) return;

    try {
      setMarkingCommissionId(record._id);
      await updateRecord(objectDef.apiName, record._id, { commission_paid: true });
      addToast("Comision marcada como pagada", "success");
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo marcar la comision", "error");
    } finally {
      setMarkingCommissionId(null);
    }
  };

  const renderCellValue = (field, record) => {
    if (field?.type === "lookup") {
      const lookup = getLookupDisplayData(field, record?.[field.apiName], record);
      if (lookup.isLinkable) {
        return (
          <button
            type="button"
            onClick={() => onOpenLookupRecord(lookup)}
            className="font-medium text-blue-600 underline-offset-2 hover:underline"
          >
            {lookup.label}
          </button>
        );
      }
    }

    return formatFieldValue(field, record[field.apiName], record);
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-4"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: adminTheme.text }}>
              {objectDef.name}
            </h3>
            <p className="text-sm" style={{ color: adminTheme.muted }}>
              {objectDef.apiName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {objectDef.apiName === "quote" ? (
              <button
                type="button"
                onClick={() => setShowQuoteBuilderModal(true)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: adminTheme.text }}
              >
                Nueva cotizacion
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: adminTheme.text }}
              >
                Nuevo registro
              </button>
            )}

            <Link
              to={`/admin/object/${objectDef.apiName}`}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              Configurar
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
              Buscar
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleApplySearch();
                }
              }}
              placeholder="Buscar registros..."
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
              Vista
            </label>
            <select
              value={viewApiName}
              onChange={(event) => setViewApiName(event.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              {(objectDef.listViews || []).map((view) => (
                <option key={view.apiName} value={view.apiName}>
                  {view.label || view.name || view.apiName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleApplySearch}
            className="rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          >
            Aplicar
          </button>
        </div>

        {activeFilters.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((filter, index) => (
              <span
                key={`${filter.field || "filter"}-${index}`}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted }}
              >
                {formatFilterLabel(filter, objectDef)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
      {loading ? (
        <div className="p-5 text-sm" style={{ color: adminTheme.muted }}>
          Cargando registros...
        </div>
      ) : records.length === 0 ? (
        <div className="p-5 text-sm" style={{ color: adminTheme.muted }}>
          No hay registros para mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }}>
                {columns.map((field) => (
                  <th
                    key={field.apiName}
                    className="border-b p-3 text-left text-sm font-semibold"
                    style={{ borderColor: adminTheme.border }}
                  >
                    <button type="button" onClick={() => handleSort(field.apiName)}>
                      {field.label}
                      {sortBy === field.apiName ? (sortOrder === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                <th className="border-b p-3 text-left text-sm font-semibold" style={{ borderColor: adminTheme.border }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  {columns.map((field) => (
                    <td
                      key={field.apiName}
                      className="border-b p-3 text-sm"
                      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    >
                      {renderCellValue(field, record)}
                    </td>
                  ))}
                  <td className="border-b p-3" style={{ borderColor: adminTheme.border }}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenRecord(record)}
                        title="Ver"
                        aria-label="Ver"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold"
                        style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                      >
                        <Eye className="h-4 w-4" strokeWidth={2} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenEditRecord(record)}
                        title="Editar"
                        aria-label="Editar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold"
                        style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2} />
                      </button>

                      {objectDef.apiName === "sales" ? (
                        <>
                          <Link
                            to={`/admin/payment/new?tab=payment&prefill_sale_id=${record._id}`}
                            title="Registrar pago"
                            aria-label="Registrar pago"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold"
                            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                          >
                            <CreditCard className="h-4 w-4" strokeWidth={2} />
                          </Link>
                          <QuickActionButton
                            onClick={() => handleSyncCampaigns(record._id)}
                            disabled={syncingCampaignId === record._id}
                            icon={Sparkles}
                            title={syncingCampaignId === record._id ? "Evaluando promo..." : "Evaluar promo"}
                            aria-label={syncingCampaignId === record._id ? "Evaluando promo..." : "Evaluar promo"}
                            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                          >
                            {syncingCampaignId === record._id ? "Evaluando..." : "Evaluar promo"}
                          </QuickActionButton>
                          {!record.commission_paid && Number(record.commission_amount || 0) > 0 ? (
                            <QuickActionButton
                              onClick={() => handleMarkCommissionPaid(record)}
                              disabled={markingCommissionId === record._id}
                              icon={BadgeCheck}
                              title={markingCommissionId === record._id ? "Marcando comision..." : "Comision pagada"}
                              aria-label={markingCommissionId === record._id ? "Marcando comision..." : "Comision pagada"}
                              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                            >
                              {markingCommissionId === record._id ? "Marcando..." : "Comision pagada"}
                            </QuickActionButton>
                          ) : null}
                        </>
                      ) : null}

                      {objectDef.apiName === "quote" ? (
                        <QuickActionButton
                          onClick={() => handleConvertQuote(record)}
                          disabled={convertingQuoteId === record._id || record.status === "Convertida"}
                          icon={ChartColumn}
                          title={
                            record.status === "Convertida"
                              ? "Convertida"
                              : convertingQuoteId === record._id
                                ? "Convirtiendo..."
                                : "Convertir"
                          }
                          aria-label={
                            record.status === "Convertida"
                              ? "Convertida"
                              : convertingQuoteId === record._id
                                ? "Convirtiendo..."
                                : "Convertir"
                          }
                          style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                        >
                          {record.status === "Convertida"
                            ? "Convertida"
                            : convertingQuoteId === record._id
                              ? "Convirtiendo..."
                              : "Convertir"}
                        </QuickActionButton>
                      ) : null}

                      {supportsClientSummary ? (
                        <QuickActionButton
                          onClick={() => handleOpenSummary(record._id)}
                          disabled={summaryLoadingId === record._id}
                          icon={FileText}
                          title={summaryLoadingId === record._id ? "Cargando resumen..." : "Resumen"}
                          aria-label={summaryLoadingId === record._id ? "Cargando resumen..." : "Resumen"}
                          style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                        >
                          {summaryLoadingId === record._id ? "Cargando..." : "Resumen"}
                        </QuickActionButton>
                      ) : null}

                      <QuickActionButton
                        onClick={() => handleDelete(record._id)}
                        icon={Trash2}
                        title="Eliminar"
                        aria-label="Eliminar"
                        style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                      >
                        Eliminar
                      </QuickActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {pagination ? (
        <Pagination pagination={pagination} onChangePage={(nextPage) => setPage(nextPage)} />
      ) : null}

      <CreateRecordModal
        open={showCreateModal}
        objectDef={objectDef}
        initialValues={createInitialValues}
        onClose={() => setShowCreateModal(false)}
        onCreated={async (createdRecord) => {
          setShowCreateModal(false);
          setPage(1);
          await (async () => {
            try {
              setLoading(true);
              const data = await getRecords(objectDef.apiName, {
                page: 1,
                limit: 12,
                search: searchTerm,
                sortBy: sortBy || "createdAt",
                sortOrder: sortOrder || "desc",
                filters: JSON.stringify(activeFilters),
              });
              setRecords(data?.records || []);
              setPagination(
                data?.pagination || {
                  page: data?.page || 1,
                  pages: data?.pages || 1,
                  total: data?.total || 0,
                  limit: data?.limit || 12,
                }
              );
            } catch (error) {
              console.error(error);
              addToast("No se pudo refrescar la lista", "error");
            } finally {
              setLoading(false);
            }
          })();

          if (createdRecord?._id) {
            onOpenRecord(createdRecord);
          }
        }}
      />

      <ClientSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        onCopy={handleCopySummary}
        onOpenWhatsApp={handleOpenWhatsApp}
        copying={copying}
        openingWhatsApp={openingWhatsApp}
      />

      <QuoteBuilderModal
        open={showQuoteBuilderModal}
        onClose={() => setShowQuoteBuilderModal(false)}
        onSaved={async ({ record }) => {
          setShowQuoteBuilderModal(false);
          if (page === 1) {
            await loadRecords();
          } else {
            setPage(1);
          }

          if (record?._id) {
            onOpenRecord(record);
          }
        }}
      />
    </div>
  );
}

function DetailFieldValue({ field, record, onOpenLookupRecord }) {
  const renderFieldValue = (field) => {
    if (field?.type === "lookup") {
      const lookup = getLookupDisplayData(field, record?.[field.apiName], record);
      if (lookup.isLinkable) {
        return (
          <button
            type="button"
            onClick={() => onOpenLookupRecord(lookup)}
            className="font-medium text-blue-600 underline-offset-2 hover:underline"
          >
            {lookup.label}
          </button>
        );
      }
    }

    return formatFieldValue(field, record?.[field.apiName], record);
  };

  return (
    <div>
      <p
        className="mb-1 text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color: adminTheme.muted }}
      >
        {field.label}
      </p>
      <div
        className="min-h-[46px] rounded-xl border p-3 text-sm"
        style={{
          backgroundColor: adminTheme.surfaceAlt,
          borderColor: adminTheme.border,
          color: adminTheme.text,
        }}
      >
        {renderFieldValue(field)}
      </div>
    </div>
  );
}

function LayoutDetailSections({ objectDef, record, onOpenLookupRecord }) {
  const fieldMap = useMemo(
    () => new Map((objectDef?.fields || []).map((field) => [field.apiName, field])),
    [objectDef?.fields]
  );

  const activeLayout = objectDef?.layout?.[0];
  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );

  if (!fieldSections.length) {
    const fallbackFields = (objectDef?.fields || [])
      .filter((field) => field.visibleInDetail !== false)
      .slice(0, 16);

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fallbackFields.map((field) => (
          <DetailFieldValue
            key={field.apiName}
            field={field}
            record={record}
            onOpenLookupRecord={onOpenLookupRecord}
          />
        ))}
      </div>
    );
  }

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return (
        <div
          key={`${item}-${index}`}
          className="h-[72px] rounded-xl border-2 border-dashed"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surfaceAlt }}
        />
      );
    }

    const field = fieldMap.get(item);
    if (!field || field.visibleInDetail === false) return null;

    return (
      <DetailFieldValue
        key={field.apiName}
        field={field}
        record={record}
        onOpenLookupRecord={onOpenLookupRecord}
      />
    );
  };

  return (
    <div className="space-y-5">
      {fieldSections.map((section, sectionIndex) => {
        const sectionFields = section.fields || [];
        const twoColumn = section.columns === 2;
        const { col1, col2 } = splitFieldsIntoColumns(sectionFields);

        return (
          <div key={`${section.label || "section"}-${sectionIndex}`}>
            {section.label ? (
              <div className="mb-4">
                <p
                  className="text-xs uppercase tracking-[0.22em]"
                  style={{ color: adminTheme.muted }}
                >
                  {section.label}
                </p>
              </div>
            ) : null}

            {twoColumn ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>{col1.map((item, index) => renderFieldOrBlank(item, index))}</div>
                <div>{col2.map((item, index) => renderFieldOrBlank(item, index + col1.length))}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sectionFields.map((item, index) => renderFieldOrBlank(item, index))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RelatedPanel({
  parentObjectApi,
  parentId,
  section,
  onOpenRecord,
  onOpenLookupRecord,
  onParentRefresh,
}) {
  const { addToast } = useToast();
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const relatedObjectDef = getObjectByApiNameFromCache(section.relatedObject);
  const relatedInitialValues = useMemo(
    () => ({ [section.relatedField]: parentId }),
    [parentId, section.relatedField]
  );

  const columns = useMemo(
    () =>
      (section.relatedColumns || [])
        .map((apiName) =>
          (relatedObjectDef?.fields || []).find((field) => field.apiName === apiName)
        )
        .filter(Boolean)
        .slice(0, 4),
    [relatedObjectDef, section.relatedColumns]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await getRelatedRecords(
          parentObjectApi,
          parentId,
          section.relatedObject,
          section.relatedField,
          {
            sortField: section.sortField || "",
            sortOrder: section.sortOrder || "desc",
          }
        );
        if (!cancelled) {
          setRecords(data?.records || []);
        }
      } catch {
        if (!cancelled) {
          setRecords([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (section.relatedObject && section.relatedField) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [
    parentId,
    parentObjectApi,
    section.relatedField,
    section.relatedObject,
    section.sortField,
    section.sortOrder,
  ]);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border }}
      >
        <h4 className="text-base font-semibold" style={{ color: adminTheme.text }}>
          {section.label}
        </h4>
        <div className="flex items-center gap-2">
          {relatedObjectDef ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              Nuevo
            </button>
          ) : null}
          <span
            className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ backgroundColor: adminTheme.surface, color: adminTheme.muted }}
          >
            Nivel 3
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm" style={{ color: adminTheme.muted }}>
          Cargando relacionados...
        </div>
      ) : records.length === 0 ? (
        <div className="p-4 text-sm" style={{ color: adminTheme.muted }}>
          No hay relacionados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: adminTheme.surfaceAlt }}>
                {columns.map((field) => (
                  <th
                    key={field.apiName}
                    className="border-b p-2 text-left text-sm font-semibold"
                    style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                  >
                    {field.label}
                  </th>
                ))}
                <th
                  className="border-b p-2 text-left text-sm font-semibold"
                  style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                >
                  Abrir
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  {columns.map((field) => (
                    <td
                      key={field.apiName}
                      className="border-b p-2 text-sm"
                      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    >
                      {field?.type === "lookup" && getLookupDisplayData(field, record[field.apiName], record).isLinkable ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenLookupRecord(getLookupDisplayData(field, record[field.apiName], record))
                          }
                          className="font-medium text-blue-600 underline-offset-2 hover:underline"
                        >
                          {getLookupDisplayData(field, record[field.apiName], record).label}
                        </button>
                      ) : (
                        formatFieldValue(field, record[field.apiName], record)
                      )}
                    </td>
                  ))}
                  <td className="border-b p-2" style={{ borderColor: adminTheme.border }}>
                    <QuickActionButton
                      type="button"
                      title="Ver"
                      aria-label="Ver"
                      icon={Eye}
                      disabled={!relatedObjectDef}
                      onClick={() =>
                        relatedObjectDef && onOpenRecord(record, relatedObjectDef)
                      }
                      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    >
                      Ver
                    </QuickActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateRecordModal
        open={showCreateModal}
        objectDef={relatedObjectDef}
        initialValues={relatedInitialValues}
        onClose={() => setShowCreateModal(false)}
        onCreated={async (createdRecord) => {
          setShowCreateModal(false);
          try {
            setLoading(true);
            const data = await getRelatedRecords(
              parentObjectApi,
              parentId,
              section.relatedObject,
              section.relatedField,
              {
                sortField: section.sortField || "",
                sortOrder: section.sortOrder || "desc",
              }
            );
            setRecords(data?.records || []);
          } catch (error) {
            console.error(error);
            addToast("No se pudo refrescar la lista relacionada", "error");
          } finally {
            setLoading(false);
          }

          onParentRefresh?.();

          if (createdRecord?._id && relatedObjectDef) {
            onOpenRecord(createdRecord, relatedObjectDef);
          }
        }}
      />
    </div>
  );
}

function RecordDetailPanelLegacy({
  objectDef,
  recordId,
  refreshKey = 0,
  allowChildren = false,
  onOpenChild,
  onOpenLookupRecord,
  onParentRefresh,
  mode = "view",
  onStartEdit,
  onCancelEdit,
  onSaved,
}) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const relatedSections = (objectDef.layout?.[0]?.sections || []).filter(
    (section) => section.type === "relatedList"
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await getRecordById(objectDef.apiName, recordId);
        if (!cancelled) {
          setRecord(data);
        }
      } catch {
        if (!cancelled) {
          setRecord(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [objectDef.apiName, recordId, refreshKey]);

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p style={{ color: adminTheme.muted }}>Cargando detalle...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p style={{ color: adminTheme.muted }}>No se pudo cargar el registro.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,4fr)_minmax(320px,2fr)]">
      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="text-xs uppercase tracking-[0.18em]"
              style={{ color: adminTheme.accentDeep }}
            >
              {objectDef.name}
            </p>
            <h3 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.text }}>
              {getRecordLabel(record, objectDef)}
            </h3>
          </div>
          <span className="text-xs" style={{ color: adminTheme.muted }}>
            {record._id}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
            {mode === "edit" ? "Editando" : "Detalles"}
          </p>

          {mode === "view" ? (
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              Editar
            </button>
          ) : null}
        </div>

        {mode === "edit" ? (
          <div className="space-y-4">
            <EditRecordPanel
              objectDef={objectDef}
              recordId={recordId}
              onSaved={onSaved}
              actions={({ saving }) => (
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold"
                    style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: adminTheme.text }}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              )}
            />
          </div>
        ) : (
          <LayoutDetailSections
            objectDef={objectDef}
            record={record}
            onOpenLookupRecord={onOpenLookupRecord}
          />
        )}
      </div>

      <div className="space-y-4">
        {allowChildren
          ? relatedSections.map((section, index) => (
              <RelatedPanel
                key={`${section.apiName || "related"}-${index}`}
                parentObjectApi={objectDef.apiName}
              parentId={recordId}
              section={section}
              onOpenRecord={onOpenChild}
              onOpenLookupRecord={onOpenLookupRecord}
              onParentRefresh={onParentRefresh}
            />
          ))
        : null}
      </div>
    </div>
  );
}

function RecordWorkspace({
  objectDef,
  tab,
  onActivateSubtab,
  onCloseSubtab,
  onOpenChild,
  onOpenLookupRecord,
  onRecordSaved,
  onRefreshRecord,
  onStartEdit,
  onCancelEdit,
}) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const activeSubtab =
    tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) || tab.subtabs[0];
  const isEditingMainRecord = activeSubtab.id === "edit";

  const childObjectDef =
    activeSubtab.type === "record"
      ? getObjectByApiNameFromCache(activeSubtab.objectApi) || objectDef
      : objectDef;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tab.subtabs.filter((subtab) => subtab.id !== "edit").map((subtab) => (
          <BadgeChip
            key={subtab.id}
            active={subtab.id === activeSubtab.id}
            label={subtab.label}
            onClick={() => onActivateSubtab(subtab.id)}
            onClose={() => onCloseSubtab(subtab.id)}
            closable={!subtab.pinned}
          />
        ))}
      </div>

      {activeSubtab.type === "detail" || isEditingMainRecord ? (
        <RecordDetailPanel
          objectDef={objectDef}
          recordId={tab.recordId}
          refreshKey={tab.refreshKey}
          allowChildren
          onOpenChild={onOpenChild}
          onOpenLookupRecord={onOpenLookupRecord}
          onParentRefresh={() => onRefreshRecord(tab.id)}
          mode={isEditingMainRecord ? "edit" : "view"}
          onStartEdit={() => onStartEdit(tab.id)}
          onCancelEdit={() => onCancelEdit(tab.id)}
          onSaved={(updatedRecord) => onRecordSaved(tab.id, objectDef, updatedRecord)}
        />
      ) : (
        <RecordDetailPanel
          objectDef={childObjectDef}
          recordId={activeSubtab.recordId}
          refreshKey={tab.refreshKey}
          allowChildren
          onOpenChild={onOpenChild}
          onOpenLookupRecord={onOpenLookupRecord}
          onParentRefresh={() => onRefreshRecord(tab.id)}
          mode={tab.activeSubtabId === "edit" ? "edit" : "view"}
          onStartEdit={() => onStartEdit(tab.id)}
          onCancelEdit={() => onCancelEdit(tab.id)}
          onSaved={(updatedRecord) => onRecordSaved(tab.id, childObjectDef, updatedRecord)}
        />
      )}
    </div>
  );
}

function currentActiveObjectApiResolver(currentObjectApi, nextTabs) {
  if (nextTabs.some((tab) => tab.objectApi === currentObjectApi)) {
    return currentObjectApi;
  }

  const fallbackTab = nextTabs[nextTabs.length - 1] || null;
  return fallbackTab?.objectApi || "";
}

function workspaceReducer(state, action) {
  switch (action.type) {
    case "SYNC_OBJECTS": {
      const { validApis, defaultObjectApi, homeTab, reportsTab, dashboardsTab } = action.payload;

      const nextTabs = [homeTab, ...state.workspaceTabs]
        .filter(
          (tab) =>
            tab.type === "home" ||
            tab.type === "reports" ||
            tab.type === "dashboards" ||
            validApis.has(tab.objectApi)
        )
        .map((tab) => {
          if (tab.type === "home") return homeTab;
          if (tab.type === "reports") return reportsTab;
          if (tab.type === "dashboards") return dashboardsTab;
          if (tab.type !== "record") return tab;

          const nextSubtabs = (tab.subtabs || [])
            .filter(
              (subtab) =>
                subtab.id === "detail" ||
                subtab.id === "edit" ||
                validApis.has(subtab.objectApi)
            )
            .map((subtab) =>
              subtab.id === "detail" ? subtab : { ...subtab, label: subtab.label || "Relacionado" }
            );

          return {
            ...tab,
            subtabs: nextSubtabs.length
              ? nextSubtabs
              : [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
            activeSubtabId:
              nextSubtabs.some((subtab) => subtab.id === tab.activeSubtabId)
                ? tab.activeSubtabId
                : "detail",
          };
        })
        .filter(
          (tab, index, tabs) => tabs.findIndex((candidate) => candidate.id === tab.id) === index
        );

      const workspaceTabs = nextTabs.length ? nextTabs : [homeTab];

      return {
        ...state,
        workspaceTabs,
        activeTabId: workspaceTabs.some((tab) => tab.id === state.activeTabId)
          ? state.activeTabId
          : HOME_TAB_ID,
        activeObjectApi:
          state.activeObjectApi && validApis.has(state.activeObjectApi)
            ? state.activeObjectApi
            : defaultObjectApi,
      };
    }
    case "OPEN_LIST_TAB": {
      const { objectDef } = action.payload;
      const nextListTab = makeListTab(objectDef);

      return {
        ...state,
        activeObjectApi: objectDef.apiName,
        activeTabId: nextListTab.id,
        workspaceTabs: state.workspaceTabs.some((tab) => tab.id === nextListTab.id)
          ? state.workspaceTabs
          : [...state.workspaceTabs, nextListTab],
      };
    }
    case "OPEN_SYSTEM_TAB": {
      const { tab } = action.payload;

      return {
        ...state,
        activeObjectApi: "",
        activeTabId: tab.id,
        workspaceTabs: state.workspaceTabs.some((currentTab) => currentTab.id === tab.id)
          ? state.workspaceTabs
          : [...state.workspaceTabs, tab],
      };
    }
    case "OPEN_RECORD_TAB": {
      const { objectApi, nextRecordTab, startInEdit = false } = action.payload;

      if (!startInEdit) {
        return {
          ...state,
          activeObjectApi: objectApi,
          activeTabId: nextRecordTab.id,
          workspaceTabs: state.workspaceTabs.some((tab) => tab.id === nextRecordTab.id)
            ? state.workspaceTabs
            : [...state.workspaceTabs, nextRecordTab],
        };
      }

      const editSubtab = makeEditSubtab();
      const existingTab = state.workspaceTabs.find((tab) => tab.id === nextRecordTab.id);

      return {
        ...state,
        activeObjectApi: objectApi,
        activeTabId: nextRecordTab.id,
        workspaceTabs:
          !existingTab || existingTab.type !== "record"
            ? [
                ...state.workspaceTabs,
                {
                  ...nextRecordTab,
                  activeSubtabId: editSubtab.id,
                  subtabs: [...nextRecordTab.subtabs, editSubtab],
                },
              ]
            : state.workspaceTabs.map((tab) => {
                if (tab.id !== nextRecordTab.id || tab.type !== "record") return tab;

                const hasEditSubtab = tab.subtabs.some((subtab) => subtab.id === editSubtab.id);
                return {
                  ...tab,
                  label: nextRecordTab.label,
                  activeSubtabId: editSubtab.id,
                  subtabs: hasEditSubtab ? tab.subtabs : [...tab.subtabs, editSubtab],
                };
              }),
      };
    }
    case "START_EDIT": {
      const { tabId } = action.payload;
      const editSubtab = makeEditSubtab();

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) => {
          if (tab.id !== tabId || tab.type !== "record") return tab;

          const hasEditSubtab = tab.subtabs.some((subtab) => subtab.id === editSubtab.id);
          return {
            ...tab,
            activeSubtabId: editSubtab.id,
            subtabs: hasEditSubtab ? tab.subtabs : [...tab.subtabs, editSubtab],
          };
        }),
      };
    }
    case "CANCEL_EDIT": {
      const { tabId } = action.payload;

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) =>
          tab.id === tabId && tab.type === "record"
            ? { ...tab, activeSubtabId: "detail" }
            : tab
        ),
      };
    }
    case "RECORD_SAVED": {
      const { tabId, objectDef, updatedRecord } = action.payload;

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) => {
          if (tab.id !== tabId || tab.type !== "record") return tab;

          return {
            ...tab,
            label: getRecordLabel(updatedRecord, objectDef),
            refreshKey: (tab.refreshKey || 0) + 1,
            activeSubtabId: "detail",
          };
        }),
      };
    }
    case "REFRESH_RECORD": {
      const { tabId } = action.payload;

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) =>
          tab.id === tabId && tab.type === "record"
            ? { ...tab, refreshKey: (tab.refreshKey || 0) + 1 }
            : tab
        ),
      };
    }
    case "FOCUS_TAB": {
      const { tab } = action.payload;

      return {
        ...state,
        activeTabId: tab.id,
        activeObjectApi: tab.objectApi || state.activeObjectApi,
      };
    }
    case "CLOSE_TAB": {
      const { tabId, homeTab } = action.payload;
      const closingTab = state.workspaceTabs.find((tab) => tab.id === tabId);

      if (closingTab?.pinned) {
        return state;
      }

      const nextTabs = state.workspaceTabs.filter((tab) => tab.id !== tabId);
      const fallbackTab = nextTabs[nextTabs.length - 1] || homeTab;
      const workspaceTabs = nextTabs.length ? nextTabs : [homeTab];

      return {
        ...state,
        workspaceTabs,
        activeTabId: state.activeTabId === tabId ? fallbackTab?.id || HOME_TAB_ID : state.activeTabId,
        activeObjectApi: currentActiveObjectApiResolver(state.activeObjectApi, nextTabs),
      };
    }
    case "OPEN_CHILD": {
      const { tabId, record, childObjectDef } = action.payload;
      const nextChildSubtab = makeChildSubtab(record, childObjectDef);

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) => {
          if (tab.id !== tabId || tab.type !== "record") return tab;

          return {
            ...tab,
            activeSubtabId: nextChildSubtab.id,
            subtabs: tab.subtabs.some((subtab) => subtab.id === nextChildSubtab.id)
              ? tab.subtabs
              : [...tab.subtabs, nextChildSubtab],
          };
        }),
      };
    }
    case "ACTIVATE_SUBTAB": {
      const { tabId, subtabId } = action.payload;

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) =>
          tab.id === tabId && tab.type === "record"
            ? { ...tab, activeSubtabId: subtabId }
            : tab
        ),
      };
    }
    case "CLOSE_SUBTAB": {
      const { tabId, subtabId } = action.payload;

      return {
        ...state,
        workspaceTabs: state.workspaceTabs.map((tab) => {
          if (tab.id !== tabId || tab.type !== "record") return tab;

          const nextSubtabs = tab.subtabs.filter((subtab) => subtab.id !== subtabId);
          return {
            ...tab,
            subtabs: nextSubtabs.length
              ? nextSubtabs
              : [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
            activeSubtabId:
              tab.activeSubtabId === subtabId
                ? nextSubtabs[nextSubtabs.length - 1]?.id || "detail"
                : tab.activeSubtabId,
          };
        }),
      };
    }
    case "RESET_WORKSPACE": {
      const { homeTab, defaultObjectApi } = action.payload;

      return {
        activeObjectApi: defaultObjectApi,
        activeTabId: homeTab.id,
        workspaceTabs: [homeTab],
      };
    }
    default:
      return state;
  }
}

export default function AdminWorkspaceLab() {
  const { objects, loading, loaded } = useObjectMetadata();
  const user = useAuthStore((state) => state.user);

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${user?._id || user?.email || "default"}`,
    [user?._id, user?.email]
  );

  const persistedState = useMemo(() => readState(storageKey), [storageKey]);
  const restored = true;

  const objectTabs = useMemo(
    () => objects.filter((obj) => obj.active !== false && obj.tabsEnabled !== false),
    [objects]
  );

  const objectMap = useMemo(
    () => new Map(objectTabs.map((objectDef) => [objectDef.apiName, objectDef])),
    [objectTabs]
  );

  const homeTab = useMemo(() => makeHomeTab(), []);
  const reportsTab = useMemo(() => makeReportsTab(), []);
  const dashboardsTab = useMemo(() => makeDashboardsTab(), []);
  const initialWorkspaceState = useMemo(
    () => ({
      activeObjectApi: persistedState?.activeObjectApi || "",
      activeTabId: persistedState?.activeTabId || HOME_TAB_ID,
      workspaceTabs: persistedState?.tabs?.length ? persistedState.tabs : [homeTab],
    }),
    [homeTab, persistedState]
  );
  const [workspaceState, dispatchWorkspace] = useReducer(
    workspaceReducer,
    initialWorkspaceState
  );
  const { activeObjectApi, activeTabId, workspaceTabs } = workspaceState;

  useEffect(() => {
    if (!restored || !objectTabs.length) return;

    dispatchWorkspace({
      type: "SYNC_OBJECTS",
      payload: {
        validApis: new Set(objectTabs.map((objectDef) => objectDef.apiName)),
        defaultObjectApi: objectTabs[0]?.apiName || "",
        homeTab,
        reportsTab,
        dashboardsTab,
      },
    });
  }, [dashboardsTab, homeTab, objectTabs, reportsTab, restored]);

  useEffect(() => {
    if (!restored) return;
    writeState(storageKey, {
      activeObjectApi,
      activeTabId,
      tabs: workspaceTabs,
    });
  }, [activeObjectApi, activeTabId, restored, storageKey, workspaceTabs]);

  const activeTab = workspaceTabs.find((tab) => tab.id === activeTabId) || homeTab;
  const activeObjectDef = objectMap.get(activeTab.objectApi);
  const levelThreeAvailable = activeTab.type === "record";

  const handleObjectLaunch = useCallback((objectDef) => {
    dispatchWorkspace({
      type: "OPEN_LIST_TAB",
      payload: { objectDef },
    });
  }, []);

  const handleOpenReports = useCallback(() => {
    dispatchWorkspace({
      type: "OPEN_SYSTEM_TAB",
      payload: { tab: reportsTab },
    });
  }, [reportsTab]);

  const handleOpenDashboards = useCallback(() => {
    dispatchWorkspace({
      type: "OPEN_SYSTEM_TAB",
      payload: { tab: dashboardsTab },
    });
  }, [dashboardsTab]);

  const handleOpenRecord = useCallback((objectDef, record) => {
    dispatchWorkspace({
      type: "OPEN_RECORD_TAB",
      payload: {
        objectApi: objectDef.apiName,
        nextRecordTab: makeRecordTab(record, objectDef),
      },
    });
  }, []);

  const handleOpenEditRecord = useCallback((objectDef, record) => {
    dispatchWorkspace({
      type: "OPEN_RECORD_TAB",
      payload: {
        objectApi: objectDef.apiName,
        nextRecordTab: makeRecordTab(record, objectDef),
        startInEdit: true,
      },
    });
  }, []);

  const handleStartEdit = useCallback((tabId) => {
    dispatchWorkspace({
      type: "START_EDIT",
      payload: { tabId },
    });
  }, []);

  const handleCancelEdit = useCallback((tabId) => {
    dispatchWorkspace({
      type: "CANCEL_EDIT",
      payload: { tabId },
    });
  }, []);

  const handleOpenLookupRecord = useCallback(
    (lookup) => {
      if (!lookup?.objectApi || !lookup?.recordId) return;

      const targetObjectDef = objectMap.get(lookup.objectApi);
      if (!targetObjectDef) return;

      const nextRecordTab = makeRecordTabFromLookup({
        objectApi: lookup.objectApi,
        recordId: lookup.recordId,
        label: lookup.label,
        objectDef: targetObjectDef,
      });

      dispatchWorkspace({
        type: "OPEN_RECORD_TAB",
        payload: {
          objectApi: targetObjectDef.apiName,
          nextRecordTab,
        },
      });
    },
    [objectMap]
  );

  const handleRecordSaved = useCallback((tabId, objectDef, updatedRecord) => {
    dispatchWorkspace({
      type: "RECORD_SAVED",
      payload: { tabId, objectDef, updatedRecord },
    });
  }, []);

  const handleRefreshRecord = useCallback((tabId) => {
    dispatchWorkspace({
      type: "REFRESH_RECORD",
      payload: { tabId },
    });
  }, []);

  const handleFocusTab = useCallback((tab) => {
    dispatchWorkspace({
      type: "FOCUS_TAB",
      payload: { tab },
    });
  }, []);

  const handleCloseTab = useCallback((tabId) => {
    dispatchWorkspace({
      type: "CLOSE_TAB",
      payload: { tabId, homeTab },
    });
  }, [homeTab]);

  const handleOpenChild = useCallback(
    (record, childObjectDef) => {
      if (!activeTab || activeTab.type !== "record") return;

      dispatchWorkspace({
        type: "OPEN_CHILD",
        payload: {
          tabId: activeTab.id,
          record,
          childObjectDef,
        },
      });
    },
    [activeTab]
  );

  const handleActivateSubtab = useCallback(
    (subtabId) => {
      if (!activeTab || activeTab.type !== "record") return;

      dispatchWorkspace({
        type: "ACTIVATE_SUBTAB",
        payload: { tabId: activeTab.id, subtabId },
      });
    },
    [activeTab]
  );

  const handleCloseSubtab = useCallback(
    (subtabId) => {
      if (!activeTab || activeTab.type !== "record") return;

      dispatchWorkspace({
        type: "CLOSE_SUBTAB",
        payload: { tabId: activeTab.id, subtabId },
      });
    },
    [activeTab]
  );

  const handleResetWorkspace = useCallback(() => {
    const initialHomeTab = makeHomeTab();
    writeState(storageKey, {
      activeObjectApi: objectTabs[0]?.apiName || "",
      activeTabId: initialHomeTab.id,
      tabs: [initialHomeTab],
    });
    dispatchWorkspace({
      type: "RESET_WORKSPACE",
      payload: {
        homeTab: initialHomeTab,
        defaultObjectApi: objectTabs[0]?.apiName || "",
      },
    });
  }, [objectTabs, storageKey]);

  if (!restored || !loaded || loading) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p style={{ color: adminTheme.muted }}>Cargando lab de navegacion...</p>
      </div>
    );
  }

  if (!objectTabs.length) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p style={{ color: adminTheme.muted }}>No hay objetos disponibles para probar el lab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section
        className="rounded-2xl border px-5 py-4"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="text-xs uppercase tracking-[0.26em]"
              style={{ color: adminTheme.muted }}
            >
              Workspace Lab
            </p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.text }}>
              Navegacion multinivel
            </h1>
            <p className="mt-1 max-w-3xl text-sm" style={{ color: adminTheme.muted }}>
              Una propuesta mas compacta: nivel 1 como lanzador, nivel 2 como tabs clasicos
              y nivel 3 como contexto local dentro del registro activo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted }}
            >
              Persiste al refrescar
            </span>
            <button
              type="button"
              onClick={handleResetWorkspace}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              Resetear workspace
            </button>
            <Link
              to="/admin"
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              Volver al admin
            </Link>
          </div>
        </div>
      </section>

      <section
        className="rounded-2xl border"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div
          className="border-b px-5 py-4"
          style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border }}
        >
          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
            Nivel 1 · Objetos
          </p>
          <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
            Cada objeto abre su lista en nivel 2 o la enfoca si ya existe.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <LauncherChip
              active={activeTab?.type === "reports"}
              label="Reportes"
              onClick={handleOpenReports}
              icon={ChartColumn}
            />
            <LauncherChip
              active={activeTab?.type === "dashboards"}
              label="Dashboards"
              onClick={handleOpenDashboards}
              icon={LayoutDashboard}
            />
            {objectTabs.map((objectDef) => (
              <LauncherChip
                key={objectDef.apiName}
                active={objectDef.apiName === activeObjectApi}
                label={objectDef.name}
                onClick={() => handleObjectLaunch(objectDef)}
              />
            ))}
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: adminTheme.border }}>
            {workspaceTabs.map((tab) => (
              <ClassicTab
                key={tab.id}
                active={tab.id === activeTab.id}
                label={tab.label}
                onClick={() => handleFocusTab(tab)}
                onClose={() => handleCloseTab(tab.id)}
                closable={!tab.pinned}
              />
            ))}
          </div>

          <div className="py-4">
            <WorkspaceHeader activeTab={activeTab} levelThreeAvailable={levelThreeAvailable} />

            {activeTab.type === "home" ? (
              <ReportsViewer />
            ) : activeTab.type === "reports" ? (
              <ReportsViewer />
            ) : activeTab.type === "dashboards" ? (
              <DashboardsViewer />
            ) : activeTab.type === "list" ? (
              <ListPanel
                objectDef={activeObjectDef}
                onOpenRecord={(record) => handleOpenRecord(activeObjectDef, record)}
                onOpenEditRecord={(record) => handleOpenEditRecord(activeObjectDef, record)}
                onOpenLookupRecord={handleOpenLookupRecord}
              />
            ) : (
              <RecordWorkspace
                objectDef={activeObjectDef}
                tab={activeTab}
                onActivateSubtab={handleActivateSubtab}
                onCloseSubtab={handleCloseSubtab}
                onOpenChild={handleOpenChild}
                onOpenLookupRecord={handleOpenLookupRecord}
                onRecordSaved={handleRecordSaved}
                onRefreshRecord={handleRefreshRecord}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

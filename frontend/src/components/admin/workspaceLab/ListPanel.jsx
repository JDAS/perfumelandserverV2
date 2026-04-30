import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ChartColumn,
  CreditCard,
  Eye,
  FileText,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import QuoteBuilderModal from "../QuoteBuilderModal";
import ClientSummaryModal from "../../ClientSummaryModal";
import Pagination from "../../ui/Pagination";
import { useToast } from "../../ui/ToastContext";
import {
  formatFieldValue,
  getDefaultListView,
  getListColumns,
  getLookupDisplayData,
} from "../../../engine/metadataEngine";
import {
  convertQuoteToSale,
  deleteRecord,
  getClientSummary,
  getSalePaymentSummary,
  getSalesPaymentHighlights,
  getRecords,
  syncSaleCampaigns,
  syncProductSupplierReference,
  updateRecord,
} from "../../../services/customService";
import { adminTheme } from "../../../theme/adminTheme";
import { CreateRecordModal } from "./RecordForms";
import { QuickActionButton } from "./WorkspaceChrome";

const PAGE_LIMIT = 20;

const SALES_PAYMENT_STYLES = {
  paid: {
    background: "#ecfdf5",
    border: "#86efac",
    text: "#166534",
  },
  due_soon: {
    background: "#fffbeb",
    border: "#fbbf24",
    text: "#92400e",
  },
  overdue: {
    background: "#fff1f2",
    border: "#fb7185",
    text: "#9f1239",
  },
};

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

export function ListPanel({ objectDef, onOpenRecord, onOpenEditRecord, onOpenLookupRecord }) {
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
  const [syncingSupplierId, setSyncingSupplierId] = useState(null);
  const [markingCommissionId, setMarkingCommissionId] = useState(null);
  const [paymentHighlights, setPaymentHighlights] = useState({});
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
        limit: PAGE_LIMIT,
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
          limit: data?.limit || PAGE_LIMIT,
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
          limit: PAGE_LIMIT,
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
            limit: data?.limit || PAGE_LIMIT,
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

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentHighlights() {
      if (objectDef.apiName !== "sales" || records.length === 0) {
        setPaymentHighlights({});
        return;
      }

      try {
        const ids = records.map((record) => record._id).filter(Boolean);
        const data = await getSalesPaymentHighlights(ids);
        if (!cancelled) {
          setPaymentHighlights(data?.highlights || {});
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPaymentHighlights({});
        }
      }
    }

    loadPaymentHighlights();
    return () => {
      cancelled = true;
    };
  }, [objectDef.apiName, records]);

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
    objectDef.apiName === "sales" ||
    objectDef.apiName === "quote" ||
    objectDef.apiName === "campaign_sale_link";

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
    if (!window.confirm("Â¿Eliminar este registro?")) return;

    try {
      await deleteRecord(objectDef.apiName, recordId);
      addToast("Registro eliminado", "success");
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo eliminar el registro", "error");
    }
  };

  const handleSyncSupplierReference = async (recordId) => {
    try {
      setSyncingSupplierId(recordId);
      await syncProductSupplierReference(recordId);
      addToast("Referencia del proveedor actualizada", "success");
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.error || "No se pudo actualizar la referencia del proveedor",
        "error"
      );
    } finally {
      setSyncingSupplierId(null);
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

  const handleOpenPaymentSummary = async (recordId) => {
    if (!recordId) return;

    try {
      setSummaryLoadingId(recordId);
      const data = await getSalePaymentSummary(recordId);
      setSummary(data);
      setSummaryOpen(true);
    } catch (error) {
      console.error(error);
      addToast("No se pudo generar el resumen de pagos", "error");
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

  const getSalesRowStyle = (record) => {
    if (objectDef.apiName !== "sales") return {};
    const highlight = paymentHighlights[String(record._id || "")];
    const style = SALES_PAYMENT_STYLES[highlight?.status];
    if (!style) return {};

    return {
      backgroundColor: style.background,
      boxShadow: `inset 4px 0 0 ${style.border}`,
    };
  };

  const getSalesPaymentBadge = (record) => {
    if (objectDef.apiName !== "sales") return null;
    const highlight = paymentHighlights[String(record._id || "")];
    const style = SALES_PAYMENT_STYLES[highlight?.status];
    if (!highlight || !style) return null;

    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: style.border, color: style.text }}
      >
        {highlight.label}
      </span>
    );
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
                        {sortBy === field.apiName ? (sortOrder === "asc" ? " â†‘" : " â†“") : ""}
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
                  <tr key={record._id} style={getSalesRowStyle(record)}>
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
                      {getSalesPaymentBadge(record) ? (
                        <div className="mb-2">{getSalesPaymentBadge(record)}</div>
                      ) : null}
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
                            />
                            <QuickActionButton
                              onClick={() => handleOpenPaymentSummary(record._id)}
                              disabled={summaryLoadingId === record._id}
                              icon={CalendarClock}
                              title={summaryLoadingId === record._id ? "Generando resumen..." : "Resumen de pagos"}
                              aria-label={summaryLoadingId === record._id ? "Generando resumen..." : "Resumen de pagos"}
                              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                            />
                            {!record.commission_paid && Number(record.commission_amount || 0) > 0 ? (
                              <QuickActionButton
                                onClick={() => handleMarkCommissionPaid(record)}
                                disabled={markingCommissionId === record._id}
                                icon={BadgeCheck}
                                title={markingCommissionId === record._id ? "Marcando comision..." : "Comision pagada"}
                                aria-label={markingCommissionId === record._id ? "Marcando comision..." : "Comision pagada"}
                                style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                              />
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
                          />
                        ) : null}

                        {objectDef.apiName === "product" ? (
                          <QuickActionButton
                            onClick={() => handleSyncSupplierReference(record._id)}
                            disabled={syncingSupplierId === record._id}
                            icon={Sparkles}
                            title={
                              syncingSupplierId === record._id
                                ? "Refrescando proveedor..."
                                : "Refrescar proveedor"
                            }
                            aria-label={
                              syncingSupplierId === record._id
                                ? "Refrescando proveedor..."
                                : "Refrescar proveedor"
                            }
                            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                          />
                        ) : null}

                        {supportsClientSummary ? (
                          <QuickActionButton
                            onClick={() => handleOpenSummary(record._id)}
                            disabled={summaryLoadingId === record._id}
                            icon={FileText}
                            title={summaryLoadingId === record._id ? "Cargando resumen..." : "Resumen"}
                            aria-label={summaryLoadingId === record._id ? "Cargando resumen..." : "Resumen"}
                            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                          />
                        ) : null}

                        <QuickActionButton
                          onClick={() => handleDelete(record._id)}
                          icon={Trash2}
                          title="Eliminar"
                          aria-label="Eliminar"
                          style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                        />
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
                limit: PAGE_LIMIT,
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
                  limit: data?.limit || PAGE_LIMIT,
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

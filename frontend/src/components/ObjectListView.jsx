import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  convertQuoteToSale,
  deleteRecord,
  getClientSummary,
  getRecords,
  syncSaleCampaigns,
  updateRecord,
} from "../services/customService";
import { buildListQuery, buildRecordListRequest } from "../engine/listEngine";
import { formatFieldValue, getBackToListSearch } from "../engine/metadataEngine";
import ClientSummaryModal from "./ClientSummaryModal";
import Pagination from "./ui/Pagination";
import { useToast } from "./ui/ToastContext";

function IconButton({
  as: Component = "button",
  label,
  className = "",
  children,
  ...props
}) {
  return (
    <Component
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {children}
    </Component>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7 9h.01M17 15h.01" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 17h6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 10v6M14 10v6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="M20 11a8 8 0 1 0 2 5.3" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

function ObjectListView({ objectDef }) {
  const { addToast } = useToast();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoadingId, setSummaryLoadingId] = useState(null);
  const [copying, setCopying] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const [convertingQuoteId, setConvertingQuoteId] = useState(null);
  const [syncingCampaignId, setSyncingCampaignId] = useState(null);
  const [markingCommissionId, setMarkingCommissionId] = useState(null);

  const listState = useMemo(
    () => buildListQuery({ searchParams, objectDef }),
    [searchParams, objectDef]
  );

  const backToListQuery = getBackToListSearch(searchParams, objectDef.apiName);
  const supportsClientSummary =
    objectDef.apiName === "sales" || objectDef.apiName === "quote";

  useEffect(() => {
    setSearchInput(listState.search || "");
  }, [listState.search]);

  const loadRecords = useCallback(async () => {
    if (!objectDef?.apiName) return;

    try {
      setLoading(true);

      const data = await getRecords(
        objectDef.apiName,
        buildRecordListRequest({ objectDef, listState })
      );

      setRecords(data.records || []);

      setPagination(
        data.pagination || {
          page: data.page || 1,
          pages: data.pages || 1,
          total: data.total || 0,
          limit: data.limit || listState.limit || 10,
        }
      );
    } catch (error) {
      console.error(error);
      setRecords([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [objectDef, listState]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const updateParams = (changes = {}) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    next.set("tab", objectDef.apiName);
    setSearchParams(next);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro?")) return;

    try {
      await deleteRecord(objectDef.apiName, id);
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "Error eliminando el registro", "error");
    }
  };

  const handleSort = (fieldApiName) => {
    const sameField = listState.sortBy === fieldApiName;

    updateParams({
      sortBy: fieldApiName,
      sortOrder: sameField && listState.sortOrder === "asc" ? "desc" : "asc",
      page: 1,
    });
  };

  const handleOpenSummary = async (recordId) => {
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

  const handleConvertQuote = async (record) => {
    if (!record?._id) return;

    if (record.status === "Convertida") {
      addToast("Esta cotizacion ya fue convertida", "warning");
      return;
    }

    if (!window.confirm("¿Convertir esta cotizacion en una venta borrador?")) {
      return;
    }

    try {
      setConvertingQuoteId(record._id);
      const result = await convertQuoteToSale(record._id);
      addToast("Cotizacion convertida en venta", "success");
      window.location.href = `/admin/sales/${result.saleId}/view?tab=sales`;
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.error || "No se pudo convertir la cotizacion",
        "error"
      );
    } finally {
      setConvertingQuoteId(null);
    }
  };

  const handleSyncCampaigns = async (recordId) => {
    if (!recordId) return;

    try {
      setSyncingCampaignId(recordId);
      const result = await syncSaleCampaigns(recordId);
      const addedEntries = Number(result?.addedEntries || 0);
      const removedEntries = Number(result?.removedEntries || 0);
      const processedCampaigns = Number(result?.processedCampaigns || 0);

      addToast(
        processedCampaigns > 0
          ? `Promo evaluada: ${addedEntries} acciones agregadas, ${removedEntries} removidas`
          : "No habia campanas aplicables para esta venta",
        "success"
      );

      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.error || "No se pudo evaluar la promo para esta venta",
        "error"
      );
    } finally {
      setSyncingCampaignId(null);
    }
  };

  const handleMarkCommissionPaid = async (record) => {
    if (!record?._id) return;

    try {
      setMarkingCommissionId(record._id);
      await updateRecord(objectDef.apiName, record._id, {
        commission_paid: true,
      });
      addToast("Comision marcada como pagada", "success");
      await loadRecords();
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.error || "No se pudo marcar la comision como pagada",
        "error"
      );
    } finally {
      setMarkingCommissionId(null);
    }
  };

  const columns = listState.columns || [];

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{objectDef.name}</h2>
          <p className="text-sm text-gray-500">{objectDef.apiName}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={
              objectDef.apiName === "quote"
                ? "/admin/quote-builder"
                : `/admin/${objectDef.apiName}/new?${backToListQuery}`
            }
            className="rounded bg-black px-4 py-2 text-white"
          >
            {objectDef.apiName === "quote" ? "Nueva cotizacion" : "Nuevo"}
          </Link>

          <Link
            to={`/admin/object/${objectDef.apiName}`}
            className="rounded bg-gray-200 px-4 py-2 text-black"
          >
            Configurar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div>
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <input
            type="text"
            placeholder="Buscar registros..."
            className="w-full rounded-lg border p-3"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParams({ search: searchInput.trim(), page: 1 });
              }
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Vista</label>
          <select
            className="min-w-48 rounded-lg border p-3"
            value={listState.viewApiName}
            onChange={(e) =>
              updateParams({
                view: e.target.value,
                page: 1,
                sortBy: undefined,
                sortOrder: undefined,
              })
            }
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
          className="rounded-lg border px-4 py-3"
          onClick={() => updateParams({ search: searchInput.trim(), page: 1 })}
        >
          Aplicar
        </button>
      </div>

      {loading ? (
        <p>Cargando registros...</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">No hay registros para esta vista.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  {columns.map((field) => (
                    <th key={field.apiName} className="border-b p-3">
                      <button
                        type="button"
                        className="font-semibold"
                        onClick={() => handleSort(field.apiName)}
                      >
                        {field.label}
                        {listState.sortBy === field.apiName
                          ? listState.sortOrder === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    </th>
                  ))}
                  <th className="border-b p-3">Creado</th>
                  <th className="border-b p-3">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    {columns.map((field) => (
                      <td key={field.apiName} className="border-b p-3">
                        {formatFieldValue(field, record[field.apiName], record)}
                      </td>
                    ))}

                    <td className="border-b p-3 text-sm text-gray-500">
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleString()
                        : "-"}
                    </td>

                    <td className="border-b p-3">
                      <div className="flex flex-wrap gap-2">
                        <IconButton
                          as={Link}
                          to={`/admin/${objectDef.apiName}/${record._id}/view?${backToListQuery}`}
                          label="Ver"
                          className="bg-blue-600"
                        >
                          <EyeIcon />
                        </IconButton>

                        <IconButton
                          as={Link}
                          to={
                            objectDef.apiName === "quote"
                              ? `/admin/quote-builder/${record._id}`
                              : `/admin/${objectDef.apiName}/${record._id}?${backToListQuery}`
                          }
                          label="Editar"
                          className="bg-yellow-500"
                        >
                          <PencilIcon />
                        </IconButton>

                        {objectDef.apiName === "sales" ? (
                          <>
                            <IconButton
                              as={Link}
                              to={`/admin/payment/new?${backToListQuery}&prefill_sale_id=${record._id}`}
                              label="Registrar pago"
                              className="bg-violet-600"
                            >
                              <MoneyIcon />
                            </IconButton>
                            <IconButton
                              type="button"
                              onClick={() => handleSyncCampaigns(record._id)}
                              disabled={syncingCampaignId === record._id}
                              label={
                                syncingCampaignId === record._id
                                  ? "Evaluando promo..."
                                  : "Evaluar promo"
                              }
                              className="bg-amber-600"
                            >
                              {syncingCampaignId === record._id ? (
                                <RefreshIcon />
                              ) : (
                                <SparkIcon />
                              )}
                            </IconButton>
                            {!record.commission_paid &&
                            Number(record.commission_amount || 0) > 0 ? (
                              <IconButton
                                type="button"
                                onClick={() => handleMarkCommissionPaid(record)}
                                disabled={markingCommissionId === record._id}
                                label={
                                  markingCommissionId === record._id
                                    ? "Marcando comision..."
                                    : "Marcar comision pagada"
                                }
                                className="bg-cyan-600"
                              >
                                {markingCommissionId === record._id ? (
                                  <RefreshIcon />
                                ) : (
                                  <CheckIcon />
                                )}
                              </IconButton>
                            ) : null}
                          </>
                        ) : null}

                        {objectDef.apiName === "quote" ? (
                          <IconButton
                            type="button"
                            onClick={() => handleConvertQuote(record)}
                            disabled={
                              convertingQuoteId === record._id ||
                              record.status === "Convertida"
                            }
                            label={
                              record.status === "Convertida"
                                ? "Convertida"
                                : convertingQuoteId === record._id
                                  ? "Convirtiendo..."
                                  : "Convertir"
                            }
                            className="bg-violet-600"
                          >
                            <RefreshIcon />
                          </IconButton>
                        ) : null}

                        {supportsClientSummary ? (
                          <IconButton
                            type="button"
                            onClick={() => handleOpenSummary(record._id)}
                            disabled={summaryLoadingId === record._id}
                            label={
                              summaryLoadingId === record._id
                                ? "Cargando resumen..."
                                : "Resumen"
                            }
                            className="bg-emerald-600"
                          >
                            <DocumentIcon />
                          </IconButton>
                        ) : null}

                        <IconButton
                          onClick={() => handleDelete(record._id)}
                          label="Eliminar"
                          className="bg-red-600"
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            pagination={pagination}
            onChangePage={(page) => updateParams({ page })}
          />
        </>
      )}

      <ClientSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        onCopy={handleCopySummary}
        onOpenWhatsApp={handleOpenWhatsApp}
        copying={copying}
        openingWhatsApp={openingWhatsApp}
      />
    </div>
  );
}

export default ObjectListView;

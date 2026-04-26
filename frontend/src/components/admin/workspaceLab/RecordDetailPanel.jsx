import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChartColumn,
  CreditCard,
  Eye,
  FileText,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import ClientSummaryModal from "../../ClientSummaryModal";
import { useToast } from "../../ui/ToastContext";
import { useObjectMetadata } from "../../../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getLookupDisplayData,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../../../engine/metadataEngine";
import {
  convertQuoteToSale,
  getClientSummary,
  getRecordById,
  getRelatedRecords,
  syncProductSupplierReference,
  syncSaleCampaigns,
  updateRecord,
} from "../../../services/customService";
import { adminTheme } from "../../../theme/adminTheme";
import { CreateRecordModal, EditRecordPanel } from "./RecordForms";
import { QuickActionButton } from "./WorkspaceChrome";

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

function DetailFieldValue({ field, record, onOpenLookupRecord }) {
  const renderFieldValue = (currentField) => {
    if (currentField?.type === "lookup") {
      const lookup = getLookupDisplayData(currentField, record?.[currentField.apiName], record);
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

    return formatFieldValue(currentField, record?.[currentField.apiName], record);
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
                      {field?.type === "lookup" &&
                      getLookupDisplayData(field, record[field.apiName], record).isLinkable ? (
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
                      onClick={() => relatedObjectDef && onOpenRecord(record, relatedObjectDef)}
                      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    />
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

function RecordActionsBar({
  objectDef,
  record,
  onOpenLookupRecord,
  onRefresh,
  onStartEdit,
}) {
  const { addToast } = useToast();
  const [busyAction, setBusyAction] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const objectApiName = objectDef?.apiName;

  const supportsSummary =
    objectApiName === "sales" ||
    objectApiName === "quote" ||
    objectApiName === "campaign_sale_link";

  const runAction = async (actionKey, handler) => {
    try {
      setBusyAction(actionKey);
      await handler();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo completar la accion", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleConvertQuote = () =>
    runAction("convertQuote", async () => {
      const result = await convertQuoteToSale(record._id);
      addToast("Cotizacion convertida en venta", "success");
      if (result?.saleId) {
        onOpenLookupRecord?.({
          objectApi: "sales",
          recordId: result.saleId,
          label: "Venta convertida",
          isLinkable: true,
        });
      }
      onRefresh?.();
    });

  const handleSyncCampaigns = () =>
    runAction("syncCampaigns", async () => {
      await syncSaleCampaigns(record._id);
      addToast("Promo evaluada", "success");
      onRefresh?.();
    });

  const handleSyncSupplier = () =>
    runAction("syncSupplier", async () => {
      await syncProductSupplierReference(record._id);
      addToast("Referencia del proveedor actualizada", "success");
      onRefresh?.();
    });

  const handleMarkCommissionPaid = () =>
    runAction("commissionPaid", async () => {
      await updateRecord(objectApiName, record._id, { commission_paid: true });
      addToast("Comision marcada como pagada", "success");
      onRefresh?.();
    });

  const handleOpenSummary = () =>
    runAction("summary", async () => {
      const data = await getClientSummary(objectApiName, record._id);
      setSummary(data);
      setSummaryOpen(true);
    });

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
      window.open(
        `https://wa.me/?text=${encodeURIComponent(summary.whatsappText)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(error);
      addToast("No se pudo abrir WhatsApp", "error");
    } finally {
      setOpeningWhatsApp(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <QuickActionButton
          onClick={onStartEdit}
          icon={Pencil}
          title="Editar"
          aria-label="Editar"
          style={{ borderColor: adminTheme.border, color: adminTheme.text }}
        />

        {objectApiName === "sales" ? (
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
              onClick={handleSyncCampaigns}
              disabled={busyAction === "syncCampaigns"}
              icon={Sparkles}
              title="Evaluar promo"
              aria-label="Evaluar promo"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            />
            {!record.commission_paid && Number(record.commission_amount || 0) > 0 ? (
              <QuickActionButton
                onClick={handleMarkCommissionPaid}
                disabled={busyAction === "commissionPaid"}
                icon={BadgeCheck}
                title="Comision pagada"
                aria-label="Comision pagada"
                style={{ borderColor: adminTheme.border, color: adminTheme.text }}
              />
            ) : null}
          </>
        ) : null}

        {objectApiName === "quote" ? (
          <QuickActionButton
            onClick={handleConvertQuote}
            disabled={busyAction === "convertQuote" || record.status === "Convertida"}
            icon={ChartColumn}
            title="Convertir a venta"
            aria-label="Convertir a venta"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          />
        ) : null}

        {objectApiName === "product" ? (
          <QuickActionButton
            onClick={handleSyncSupplier}
            disabled={busyAction === "syncSupplier"}
            icon={Sparkles}
            title="Refrescar proveedor"
            aria-label="Refrescar proveedor"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          />
        ) : null}

        {supportsSummary ? (
          <QuickActionButton
            onClick={handleOpenSummary}
            disabled={busyAction === "summary"}
            icon={FileText}
            title="Resumen"
            aria-label="Resumen"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          />
        ) : null}
      </div>

      <ClientSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        onCopy={handleCopySummary}
        onOpenWhatsApp={handleOpenWhatsApp}
        copying={copying}
        openingWhatsApp={openingWhatsApp}
      />
    </>
  );
}

export function RecordDetailPanel({
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

        {mode === "view" ? (
          <RecordActionsBar
            objectDef={objectDef}
            record={record}
            onOpenLookupRecord={onOpenLookupRecord}
            onRefresh={onParentRefresh}
            onStartEdit={onStartEdit}
          />
        ) : null}

        {mode === "edit" ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
              Editando
            </p>
          </div>
        ) : null}

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

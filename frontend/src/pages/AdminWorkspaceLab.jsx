import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ReportsViewer from "../components/admin/ReportsViewer";
import Pagination from "../components/ui/Pagination";
import { renderFieldInput } from "../components/fields/FieldRegistry";
import { useToast } from "../components/ui/ToastContext";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getLookupDisplayData,
  getDefaultListView,
  getFormFields,
  getListColumns,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../engine/metadataEngine";
import { createRecord, getRecordById, getRecords, getRelatedRecords } from "../services/customService";
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

function LauncherChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-sm font-medium transition"
      style={
        active
          ? {
              backgroundColor: adminTheme.text,
              color: "#FFFFFF",
              borderColor: adminTheme.text,
            }
          : {
              backgroundColor: adminTheme.surface,
              color: adminTheme.text,
              borderColor: adminTheme.border,
            }
      }
    >
      {label}
    </button>
  );
}

function CloseIcon({ className = "h-3 w-3" }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M3 3L9 9" />
      <path d="M9 3L3 9" />
    </svg>
  );
}

function ClassicTab({ active, label, onClick, onClose, closable = false }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-3 text-sm font-medium"
      style={
        active
          ? {
              backgroundColor: adminTheme.surface,
              color: adminTheme.text,
              borderColor: adminTheme.border,
              transform: "translateY(1px)",
            }
          : {
              backgroundColor: adminTheme.surfaceAlt,
              color: adminTheme.muted,
              borderColor: adminTheme.border,
            }
      }
    >
      <button type="button" onClick={onClick} className="text-left">
        {label}
      </button>
      {closable ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold transition"
          title={`Cerrar ${label}`}
          aria-label={`Cerrar ${label}`}
          style={
            active
              ? {
                  backgroundColor: adminTheme.surfaceAlt,
                  color: adminTheme.muted,
                }
              : {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  color: adminTheme.muted,
              }
          }
        >
          <CloseIcon className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

function BadgeChip({ active, label, onClick, onClose, closable = false }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
      style={
        active
          ? {
              backgroundColor: adminTheme.text,
              color: "#FFFFFF",
              borderColor: adminTheme.text,
            }
          : {
              backgroundColor: adminTheme.surfaceAlt,
              color: adminTheme.muted,
              borderColor: adminTheme.border,
            }
      }
    >
      <button type="button" onClick={onClick} className="text-left">
        {label}
      </button>
      {closable ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-semibold transition"
          title={`Cerrar ${label}`}
          aria-label={`Cerrar ${label}`}
          style={
            active
              ? {
                  backgroundColor: "rgba(255,255,255,0.16)",
                  color: "#FFFFFF",
                }
              : {
                  backgroundColor: adminTheme.surface,
                  color: adminTheme.muted,
              }
          }
        >
          <CloseIcon className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

function WorkspaceHeader({ activeTab, levelThreeAvailable }) {
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

function CreateRecordModal({ open, objectDef, onClose, onCreated }) {
  const { addToast } = useToast();
  const fields = useMemo(() => getFormFields(objectDef), [objectDef]);
  const activeLayout = objectDef?.layout?.[0];
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const initialState = Object.fromEntries(
      fields.map((field) => [field.apiName, getFieldDefaultValue(field)])
    );
    setFormData(initialState);
  }, [fields, open]);

  if (!open || !objectDef) return null;

  const handleChange = (apiName, value) => {
    setFormData((prev) => ({
      ...prev,
      [apiName]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    for (const field of fields) {
      const value = formData[field.apiName];
      if (field.required && (value === undefined || value === null || value === "")) {
        addToast(`${field.label} es requerido`, "warning");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = Object.fromEntries(
        fields
          .filter((field) => !["formula", "rollup"].includes(field.type))
          .map((field) => [field.apiName, formData[field.apiName]])
      );
      const createdRecord = await createRecord(objectDef.apiName, payload);
      addToast("Registro creado", "success");
      await onCreated?.(createdRecord);
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo crear el registro", "error");
    } finally {
      setSaving(false);
    }
  };

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

    const field = fields.find((currentField) => currentField.apiName === item);
    if (!field) return null;

    return (
      <div key={field.apiName} className="mb-3">
        {field.type !== "boolean" ? (
          <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
            {field.label}
            {field.required ? <span className="ml-1 text-red-500">*</span> : null}
          </label>
        ) : null}

        {renderFieldInput(
          field,
          formData[field.apiName],
          (value) => handleChange(field.apiName, value),
          {
            objectDef,
            formData,
            setFormData,
          }
        )}
      </div>
    );
  };

  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: adminTheme.border }}
        >
          <div>
            <h2 className="text-xl font-semibold" style={{ color: adminTheme.text }}>
              Nuevo {objectDef.name}
            </h2>
            <p className="text-sm" style={{ color: adminTheme.muted }}>
              Crea el registro sin salir del workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
            {fieldSections.length ? (
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
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {fields.map((field, index) => renderFieldOrBlank(field.apiName, index))}
              </div>
            )}
          </div>

          <div
            className="flex justify-end gap-3 border-t px-6 py-4"
            style={{ borderColor: adminTheme.border }}
          >
            <button
              type="button"
              onClick={onClose}
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
              {saving ? "Guardando..." : "Crear registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatValueForInput(field, value) {
  if (value === undefined || value === null || value === "") return "";

  if (field.type === "boolean") {
    return Boolean(value);
  }

  if (field.type === "date") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  if (field.type === "datetime") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  return value;
}

function resolveDateDefaultValue(defaultValue) {
  if (
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue) &&
    defaultValue.mode === "relative"
  ) {
    const today = new Date();
    const resolved = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + (Number(defaultValue.offsetDays) || 0)
    );

    return resolved.toISOString().slice(0, 10);
  }

  if (
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue)
  ) {
    return defaultValue.value || "";
  }

  return defaultValue;
}

function getFieldDefaultValue(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== "") {
    const defaultValue =
      field.type === "date"
        ? resolveDateDefaultValue(field.defaultValue)
        : field.defaultValue;

    return formatValueForInput(field, defaultValue);
  }

  if (field.type === "boolean") {
    return false;
  }

  return "";
}

function ListPanel({ objectDef, onOpenRecord, onOpenLookupRecord }) {
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
  const listView = useMemo(() => getDefaultListView(objectDef), [objectDef]);
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
  const activeFilters = currentView?.filters || [];

  useEffect(() => {
    setViewApiName(listView?.apiName || "");
  }, [listView?.apiName]);

  useEffect(() => {
    setSortBy(currentView?.sortBy || "createdAt");
    setSortOrder(currentView?.sortOrder || "desc");
    setPage(1);
  }, [currentView?.apiName, currentView?.sortBy, currentView?.sortOrder]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
        if (!cancelled) {
          setRecords(data?.records || []);
          setPagination(
            data?.pagination || {
              page: data?.page || page,
              pages: data?.pages || 1,
              total: data?.total || 0,
              limit: data?.limit || 12,
            }
          );
        }
      } catch {
        if (!cancelled) {
          setRecords([]);
          setPagination(null);
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

  const createHref =
    objectDef.apiName === "quote"
      ? "/admin/quote-builder"
      : `/admin/${objectDef.apiName}/new?tab=${objectDef.apiName}`;

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
              <Link
                to={createHref}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: adminTheme.text }}
              >
                Nueva cotizacion
              </Link>
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
                <th
                  className="border-b p-3 text-left text-sm font-semibold"
                  style={{ borderColor: adminTheme.border }}
                >
                  Accion
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
                    <button
                      type="button"
                      onClick={() => onOpenRecord(record)}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold"
                      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    >
                      Ver
                    </button>
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

function RelatedPanel({ parentObjectApi, parentId, section, onOpenRecord, onOpenLookupRecord }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const relatedObjectDef = getObjectByApiNameFromCache(section.relatedObject);

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
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ backgroundColor: adminTheme.surface, color: adminTheme.muted }}
        >
          Nivel 3
        </span>
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
                    <button
                      type="button"
                      disabled={!relatedObjectDef}
                      onClick={() =>
                        relatedObjectDef && onOpenRecord(record, relatedObjectDef)
                      }
                      className="rounded-lg border px-3 py-1 text-sm font-medium disabled:opacity-60"
                      style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    >
                      Ver hijo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordDetailPanel({
  objectDef,
  recordId,
  allowChildren = false,
  onOpenChild,
  onOpenLookupRecord,
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
  }, [objectDef.apiName, recordId]);

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

        <LayoutDetailSections
          objectDef={objectDef}
          record={record}
          onOpenLookupRecord={onOpenLookupRecord}
        />
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
}) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const activeSubtab =
    tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) || tab.subtabs[0];

  const childObjectDef =
    activeSubtab.type === "record"
      ? getObjectByApiNameFromCache(activeSubtab.objectApi) || objectDef
      : objectDef;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tab.subtabs.map((subtab) => (
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

      {activeSubtab.type === "detail" ? (
        <RecordDetailPanel
          objectDef={objectDef}
          recordId={tab.recordId}
          allowChildren
          onOpenChild={onOpenChild}
          onOpenLookupRecord={onOpenLookupRecord}
        />
      ) : (
        <RecordDetailPanel
          objectDef={childObjectDef}
          recordId={activeSubtab.recordId}
          allowChildren
          onOpenChild={onOpenChild}
          onOpenLookupRecord={onOpenLookupRecord}
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

export default function AdminWorkspaceLab() {
  const { objects, loading, loaded } = useObjectMetadata();
  const user = useAuthStore((state) => state.user);

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${user?._id || user?.email || "default"}`,
    [user?._id, user?.email]
  );

  const [activeObjectApi, setActiveObjectApi] = useState("");
  const [activeTabId, setActiveTabId] = useState(HOME_TAB_ID);
  const [workspaceTabs, setWorkspaceTabs] = useState([makeHomeTab()]);
  const [restored, setRestored] = useState(false);

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

  useEffect(() => {
    const persisted = readState(storageKey);
    setActiveObjectApi(persisted?.activeObjectApi || "");
    setActiveTabId(persisted?.activeTabId || HOME_TAB_ID);
    setWorkspaceTabs(persisted?.tabs?.length ? persisted.tabs : [homeTab]);
    setRestored(true);
  }, [homeTab, storageKey]);

  useEffect(() => {
    if (!restored || !objectTabs.length) return;

    setWorkspaceTabs((current) => {
      const validApis = new Set(objectTabs.map((objectDef) => objectDef.apiName));

      const nextTabs = [homeTab, ...current]
        .filter(
          (tab) =>
            tab.type === "home" ||
            tab.type === "reports" ||
            tab.type === "dashboards" ||
            validApis.has(tab.objectApi)
        )
        .map((tab) => {
          if (tab.type === "home") {
            return homeTab;
          }

          if (tab.type === "reports") {
            return reportsTab;
          }

          if (tab.type === "dashboards") {
            return dashboardsTab;
          }

          if (tab.type !== "record") return tab;

          const nextSubtabs = (tab.subtabs || [])
            .filter((subtab) => subtab.id === "detail" || validApis.has(subtab.objectApi))
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

      const finalTabs = nextTabs.length ? nextTabs : [homeTab];

      setActiveTabId((currentActiveTabId) =>
        finalTabs.some((tab) => tab.id === currentActiveTabId) ? currentActiveTabId : HOME_TAB_ID
      );

      setActiveObjectApi((currentObjectApi) => {
        if (currentObjectApi && objectMap.has(currentObjectApi)) {
          return currentObjectApi;
        }
        return objectTabs[0]?.apiName || "";
      });

      return finalTabs;
    });
  }, [dashboardsTab, homeTab, objectMap, objectTabs, reportsTab, restored]);

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
    const nextListTab = makeListTab(objectDef);
    setActiveObjectApi(objectDef.apiName);
    setActiveTabId(nextListTab.id);
    setWorkspaceTabs((current) =>
      current.some((tab) => tab.id === nextListTab.id) ? current : [...current, nextListTab]
    );
  }, []);

  const handleOpenReports = useCallback(() => {
    setActiveObjectApi("");
    setActiveTabId(reportsTab.id);
    setWorkspaceTabs((current) =>
      current.some((tab) => tab.id === reportsTab.id) ? current : [...current, reportsTab]
    );
  }, [reportsTab]);

  const handleOpenDashboards = useCallback(() => {
    setActiveObjectApi("");
    setActiveTabId(dashboardsTab.id);
    setWorkspaceTabs((current) =>
      current.some((tab) => tab.id === dashboardsTab.id) ? current : [...current, dashboardsTab]
    );
  }, [dashboardsTab]);

  const handleOpenRecord = useCallback((objectDef, record) => {
    const nextRecordTab = makeRecordTab(record, objectDef);
    setActiveObjectApi(objectDef.apiName);
    setActiveTabId(nextRecordTab.id);
    setWorkspaceTabs((current) =>
      current.some((tab) => tab.id === nextRecordTab.id) ? current : [...current, nextRecordTab]
    );
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

      setActiveObjectApi(targetObjectDef.apiName);
      setActiveTabId(nextRecordTab.id);
      setWorkspaceTabs((current) =>
        current.some((tab) => tab.id === nextRecordTab.id) ? current : [...current, nextRecordTab]
      );
    },
    [objectMap]
  );

  const handleFocusTab = useCallback((tab) => {
    setActiveTabId(tab.id);
    if (tab.objectApi) {
      setActiveObjectApi(tab.objectApi);
    }
  }, []);

  const handleCloseTab = useCallback((tabId) => {
    setWorkspaceTabs((current) => {
      const closingTab = current.find((tab) => tab.id === tabId);
      if (closingTab?.pinned) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab.id !== tabId);
      const fallbackTab = nextTabs[nextTabs.length - 1] || homeTab;

      setActiveTabId((currentActive) =>
        currentActive === tabId ? fallbackTab?.id || HOME_TAB_ID : currentActive
      );

      setActiveObjectApi((currentObjectApi) =>
        currentActiveObjectApiResolver(currentObjectApi, nextTabs)
      );

      return nextTabs.length ? nextTabs : [homeTab];
    });
  }, [homeTab]);

  const handleOpenChild = useCallback(
    (record, childObjectDef) => {
      if (!activeTab || activeTab.type !== "record") return;

      const nextChildSubtab = makeChildSubtab(record, childObjectDef);

      setWorkspaceTabs((current) =>
        current.map((tab) => {
          if (tab.id !== activeTab.id || tab.type !== "record") return tab;

          return {
            ...tab,
            activeSubtabId: nextChildSubtab.id,
            subtabs: tab.subtabs.some((subtab) => subtab.id === nextChildSubtab.id)
              ? tab.subtabs
              : [...tab.subtabs, nextChildSubtab],
          };
        })
      );
    },
    [activeTab]
  );

  const handleActivateSubtab = useCallback(
    (subtabId) => {
      if (!activeTab || activeTab.type !== "record") return;

      setWorkspaceTabs((current) =>
        current.map((tab) =>
          tab.id === activeTab.id && tab.type === "record"
            ? { ...tab, activeSubtabId: subtabId }
            : tab
        )
      );
    },
    [activeTab]
  );

  const handleCloseSubtab = useCallback(
    (subtabId) => {
      if (!activeTab || activeTab.type !== "record") return;

      setWorkspaceTabs((current) =>
        current.map((tab) => {
          if (tab.id !== activeTab.id || tab.type !== "record") return tab;

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
        })
      );
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
    setActiveObjectApi(objectTabs[0]?.apiName || "");
    setActiveTabId(initialHomeTab.id);
    setWorkspaceTabs([initialHomeTab]);
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
            />
            <LauncherChip
              active={activeTab?.type === "dashboards"}
              label="Dashboards"
              onClick={handleOpenDashboards}
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
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

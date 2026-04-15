import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReportsViewer from "../components/admin/ReportsViewer";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getDefaultListView,
  getDetailFields,
  getListColumns,
} from "../engine/metadataEngine";
import { getRecordById, getRecords, getRelatedRecords } from "../services/customService";
import { useAuthStore } from "../store/authStore";
import { adminTheme } from "../theme/adminTheme";

const STORAGE_PREFIX = "admin-workspace-lab-v2";
const HOME_TAB_ID = "home:financial-report";

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
          className="text-xs opacity-80 hover:opacity-100"
          title={`Cerrar ${label}`}
          aria-label={`Cerrar ${label}`}
        >
          x
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
          className="text-[10px] opacity-80 hover:opacity-100"
          title={`Cerrar ${label}`}
          aria-label={`Cerrar ${label}`}
        >
          x
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

function ListPanel({ objectDef, onOpenRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const listView = useMemo(() => getDefaultListView(objectDef), [objectDef]);
  const columns = useMemo(
    () => getListColumns(objectDef, listView).slice(0, 6),
    [objectDef, listView]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await getRecords(objectDef.apiName, {
          page: 1,
          limit: 12,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
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

    load();
    return () => {
      cancelled = true;
    };
  }, [objectDef.apiName]);

  return (
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
                    {field.label}
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
                      {formatFieldValue(field, record[field.apiName], record)}
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
  );
}

function FieldGrid({ objectDef, record }) {
  const fields = getDetailFields(objectDef).slice(0, 16);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div key={field.apiName}>
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
            {formatFieldValue(field, record?.[field.apiName], record)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RelatedPanel({ parentObjectApi, parentId, section, onOpenRecord }) {
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
                      {formatFieldValue(field, record[field.apiName], record)}
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

function RecordDetailPanel({ objectDef, recordId, allowChildren = false, onOpenChild }) {
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
    <div className="space-y-4">
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

        <FieldGrid objectDef={objectDef} record={record} />
      </div>

      {allowChildren
        ? relatedSections.map((section, index) => (
            <RelatedPanel
              key={`${section.apiName || "related"}-${index}`}
              parentObjectApi={objectDef.apiName}
              parentId={recordId}
              section={section}
              onOpenRecord={onOpenChild}
            />
          ))
        : null}
    </div>
  );
}

function RecordWorkspace({ objectDef, tab, onActivateSubtab, onCloseSubtab, onOpenChild }) {
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
        />
      ) : (
        <RecordDetailPanel objectDef={childObjectDef} recordId={activeSubtab.recordId} />
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
        .filter((tab) => tab.type === "home" || validApis.has(tab.objectApi))
        .map((tab) => {
          if (tab.type === "home") {
            return homeTab;
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

      return nextTabs.length ? nextTabs : [homeTab];
    });

    setActiveTabId((current) => {
      const validIds = new Set(
        [homeTab, ...workspaceTabs]
          .filter((tab) => tab.type === "home" || objectMap.has(tab.objectApi))
          .map((tab) => tab.id)
      );

      return current && validIds.has(current) ? current : HOME_TAB_ID;
    });

    setActiveObjectApi((current) => {
      if (current && objectMap.has(current)) return current;
      return objectTabs[0]?.apiName || "";
    });
  }, [homeTab, objectMap, objectTabs, restored, workspaceTabs]);

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

  const handleOpenRecord = useCallback((objectDef, record) => {
    const nextRecordTab = makeRecordTab(record, objectDef);
    setActiveObjectApi(objectDef.apiName);
    setActiveTabId(nextRecordTab.id);
    setWorkspaceTabs((current) =>
      current.some((tab) => tab.id === nextRecordTab.id) ? current : [...current, nextRecordTab]
    );
  }, []);

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
            ) : activeTab.type === "list" ? (
              <ListPanel
                objectDef={activeObjectDef}
                onOpenRecord={(record) => handleOpenRecord(activeObjectDef, record)}
              />
            ) : (
              <RecordWorkspace
                objectDef={activeObjectDef}
                tab={activeTab}
                onActivateSubtab={handleActivateSubtab}
                onCloseSubtab={handleCloseSubtab}
                onOpenChild={handleOpenChild}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

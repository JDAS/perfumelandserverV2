import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  BadgeDollarSign,
  Boxes,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  ContactRound,
  FlaskConical,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ReportsViewer from "../components/admin/ReportsViewer";
import { HomePanel } from "../components/admin/workspaceLab/HomePanel";
import { ListPanel } from "../components/admin/workspaceLab/ListPanel";
import { RecordWorkspace } from "../components/admin/workspaceLab/RecordWorkspace";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { formatFieldValue } from "../engine/metadataEngine";
import { useAuthStore } from "../store/authStore";
import { adminTheme } from "../theme/adminTheme";

const STORAGE_PREFIX = "admin-workspace-lab2-v1";
const HOME_TAB_ID = "system:home";
const REPORTS_TAB_ID = "system:reports";
const DASHBOARDS_TAB_ID = "system:dashboards";
const PRICE_REVIEW_TAB_ID = "report:price_review";

const AREAS = [
  {
    id: "commercial",
    label: "Comercial",
    icon: ShoppingBag,
    objects: ["sales", "quote", "client", "seller"],
    tools: ["home", "reports"],
  },
  {
    id: "catalog",
    label: "Catalogo",
    icon: Boxes,
    objects: ["product", "stock", "quote_item", "sale_item"],
    tools: ["priceReview"],
  },
  {
    id: "finance",
    label: "Finanzas",
    icon: BadgeDollarSign,
    objects: ["payment", "payment_plan"],
    tools: ["reports", "dashboards"],
  },
  {
    id: "campaigns",
    label: "Campanas",
    icon: Megaphone,
    objects: ["campaign", "campaign_participant", "campaign_entry", "campaign_sale_link"],
    tools: ["reports"],
  },
  {
    id: "operations",
    label: "Operacion",
    icon: ClipboardList,
    objects: ["tester", "tester_log"],
    tools: ["flows", "dashboards"],
  },
  {
    id: "people",
    label: "Clientes",
    icon: ContactRound,
    objects: ["client", "seller"],
    tools: ["reports"],
  },
];

function readState(key) {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      activeAreaId: typeof parsed?.activeAreaId === "string" ? parsed.activeAreaId : "",
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
    // session storage is optional for the lab.
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

function makeSystemTab(type) {
  if (type === "priceReview") {
    return {
      id: PRICE_REVIEW_TAB_ID,
      type: "priceReview",
      objectApi: "",
      label: "Revision de precios",
    };
  }

  if (type === "reports") {
    return { id: REPORTS_TAB_ID, type: "reports", objectApi: "", label: "Reportes" };
  }

  if (type === "dashboards") {
    return { id: DASHBOARDS_TAB_ID, type: "dashboards", objectApi: "", label: "Dashboards" };
  }

  return { id: HOME_TAB_ID, type: "home", objectApi: "", label: "Inicio", pinned: true };
}

function getRecordLabel(record, objectDef) {
  const directKeys = ["name", "title", "product_name", "customer_name", "client_name", "brand"];

  for (const key of directKeys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const field of objectDef?.fields || []) {
    const formatted = formatFieldValue(field, record?.[field.apiName], record);
    if (formatted && formatted !== "-") return formatted;
  }

  return `${objectDef?.name || "Registro"} ${String(record?._id || "").slice(-6)}`;
}

function makeListTab(objectDef) {
  return {
    id: listTabId(objectDef.apiName),
    type: "list",
    objectApi: objectDef.apiName,
    label: objectDef.name,
  };
}

function makeRecordTab(record, objectDef) {
  return {
    id: recordTabId(objectDef.apiName, record._id),
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: getRecordLabel(record, objectDef),
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
  };
}

function makeEditSubtab() {
  return { id: "edit", type: "edit", label: "Editar" };
}

function workspaceReducer(state, action) {
  switch (action.type) {
    case "SYNC": {
      const { validApis, homeTab } = action.payload;
      const tabs = [homeTab, ...state.tabs]
        .filter(
          (tab) =>
            tab.type === "home" ||
            tab.type === "reports" ||
            tab.type === "dashboards" ||
            tab.type === "priceReview" ||
            validApis.has(tab.objectApi)
        )
        .filter((tab, index, allTabs) => allTabs.findIndex((candidate) => candidate.id === tab.id) === index);

      return {
        ...state,
        tabs: tabs.length ? tabs : [homeTab],
        activeTabId: tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : HOME_TAB_ID,
      };
    }

    case "SET_AREA":
      return { ...state, activeAreaId: action.payload.areaId };

    case "OPEN_SYSTEM": {
      const tab = makeSystemTab(action.payload.type);
      return {
        ...state,
        activeTabId: tab.id,
        tabs: state.tabs.some((current) => current.id === tab.id) ? state.tabs : [...state.tabs, tab],
      };
    }

    case "OPEN_LIST": {
      const tab = makeListTab(action.payload.objectDef);
      return {
        ...state,
        activeTabId: tab.id,
        tabs: state.tabs.some((current) => current.id === tab.id) ? state.tabs : [...state.tabs, tab],
      };
    }

    case "OPEN_RECORD": {
      const { objectApi, tab, startInEdit = false } = action.payload;
      const existing = state.tabs.find((current) => current.id === tab.id);
      const editSubtab = makeEditSubtab();
      const nextTab =
        startInEdit && !existing
          ? { ...tab, activeSubtabId: "edit", subtabs: [...tab.subtabs, editSubtab] }
          : tab;

      return {
        ...state,
        activeAreaId: state.activeAreaId,
        activeTabId: tab.id,
        tabs: existing
          ? state.tabs.map((current) => {
              if (current.id !== tab.id || current.type !== "record") return current;
              if (!startInEdit) return current;
              const hasEdit = current.subtabs.some((subtab) => subtab.id === "edit");
              return {
                ...current,
                activeSubtabId: "edit",
                subtabs: hasEdit ? current.subtabs : [...current.subtabs, editSubtab],
              };
            })
          : [...state.tabs, { ...nextTab, objectApi }],
      };
    }

    case "FOCUS_TAB":
      return { ...state, activeTabId: action.payload.tabId };

    case "CLOSE_TAB": {
      const tab = state.tabs.find((current) => current.id === action.payload.tabId);
      if (tab?.pinned) return state;
      const nextTabs = state.tabs.filter((current) => current.id !== action.payload.tabId);
      const fallback = nextTabs[nextTabs.length - 1] || makeSystemTab("home");
      return {
        ...state,
        tabs: nextTabs.length ? nextTabs : [fallback],
        activeTabId: state.activeTabId === action.payload.tabId ? fallback.id : state.activeTabId,
      };
    }

    case "START_EDIT":
      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (tab.id !== action.payload.tabId || tab.type !== "record") return tab;
          const editSubtab = makeEditSubtab();
          const hasEdit = tab.subtabs.some((subtab) => subtab.id === "edit");
          return {
            ...tab,
            activeSubtabId: "edit",
            subtabs: hasEdit ? tab.subtabs : [...tab.subtabs, editSubtab],
          };
        }),
      };

    case "CANCEL_EDIT":
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.payload.tabId && tab.type === "record"
            ? { ...tab, activeSubtabId: "detail" }
            : tab
        ),
      };

    case "RECORD_SAVED":
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.payload.tabId && tab.type === "record"
            ? {
                ...tab,
                label: getRecordLabel(action.payload.updatedRecord, action.payload.objectDef),
                refreshKey: (tab.refreshKey || 0) + 1,
                activeSubtabId: "detail",
              }
            : tab
        ),
      };

    case "REFRESH_RECORD":
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.payload.tabId && tab.type === "record"
            ? { ...tab, refreshKey: (tab.refreshKey || 0) + 1 }
            : tab
        ),
      };

    case "OPEN_CHILD":
      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (tab.id !== action.payload.tabId || tab.type !== "record") return tab;
          const subtab = makeChildSubtab(action.payload.record, action.payload.childObjectDef);
          return {
            ...tab,
            activeSubtabId: subtab.id,
            subtabs: tab.subtabs.some((current) => current.id === subtab.id)
              ? tab.subtabs
              : [...tab.subtabs, subtab],
          };
        }),
      };

    case "ACTIVATE_SUBTAB":
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.payload.tabId && tab.type === "record"
            ? { ...tab, activeSubtabId: action.payload.subtabId }
            : tab
        ),
      };

    case "CLOSE_SUBTAB":
      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (tab.id !== action.payload.tabId || tab.type !== "record") return tab;
          const subtabs = tab.subtabs.filter((subtab) => subtab.id !== action.payload.subtabId);
          return {
            ...tab,
            subtabs: subtabs.length ? subtabs : [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
            activeSubtabId:
              tab.activeSubtabId === action.payload.subtabId
                ? subtabs[subtabs.length - 1]?.id || "detail"
                : tab.activeSubtabId,
          };
        }),
      };

    case "RESET":
      return { activeAreaId: "commercial", activeTabId: HOME_TAB_ID, tabs: [makeSystemTab("home")] };

    default:
      return state;
  }
}

function AreaButton({ area, active, onClick }) {
  const Icon = area.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition"
      style={
        active
          ? { backgroundColor: adminTheme.text, color: "#fff" }
          : { backgroundColor: "transparent", color: adminTheme.text }
      }
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
      <span className="min-w-0 flex-1 truncate">{area.label}</span>
      <ChevronRight className="h-4 w-4 opacity-70" strokeWidth={2} />
    </button>
  );
}

function WorkTab({ tab, active, onFocus, onClose }) {
  return (
    <div
      className="inline-flex h-10 min-w-0 items-center gap-2 border-b-2 px-3 text-sm font-medium"
      style={{
        borderColor: active ? adminTheme.text : "transparent",
        color: active ? adminTheme.text : adminTheme.muted,
      }}
    >
      <button type="button" onClick={onFocus} className="max-w-48 truncate text-left">
        {tab.label}
      </button>
      {!tab.pinned ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md"
          title={`Cerrar ${tab.label}`}
          aria-label={`Cerrar ${tab.label}`}
          style={{ backgroundColor: active ? adminTheme.surfaceAlt : "transparent" }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}

function ContextPanel({ activeTab, activeArea, objectDef }) {
  return (
    <aside
      className="hidden w-80 shrink-0 border-l px-4 py-5 xl:block"
      style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
        Contexto
      </p>
      <h3 className="mt-2 text-base font-semibold" style={{ color: adminTheme.text }}>
        {activeTab?.label || activeArea?.label || "Workspace"}
      </h3>
      <div className="mt-4 space-y-3 text-sm" style={{ color: adminTheme.muted }}>
        <div className="rounded-lg border p-3" style={{ borderColor: adminTheme.border }}>
          <p className="font-semibold" style={{ color: adminTheme.text }}>
            Area activa
          </p>
          <p className="mt-1">{activeArea?.label || "Sin area"}</p>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: adminTheme.border }}>
          <p className="font-semibold" style={{ color: adminTheme.text }}>
            Vista
          </p>
          <p className="mt-1">{activeTab?.type || "home"}</p>
        </div>
        {objectDef ? (
          <div className="rounded-lg border p-3" style={{ borderColor: adminTheme.border }}>
            <p className="font-semibold" style={{ color: adminTheme.text }}>
              Objeto
            </p>
            <p className="mt-1">{objectDef.name}</p>
            <p className="mt-1 text-xs">{objectDef.apiName}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default function AdminWorkspaceLab2() {
  const { objects, loading, loaded } = useObjectMetadata();
  const user = useAuthStore((state) => state.user);
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${user?._id || user?.email || "default"}`,
    [user?._id, user?.email]
  );
  const persistedState = useMemo(() => readState(storageKey), [storageKey]);

  const objectTabs = useMemo(
    () => objects.filter((obj) => obj.active !== false && obj.tabsEnabled !== false),
    [objects]
  );
  const objectMap = useMemo(
    () => new Map(objectTabs.map((objectDef) => [objectDef.apiName, objectDef])),
    [objectTabs]
  );

  const [state, dispatch] = useReducer(workspaceReducer, {
    activeAreaId: persistedState?.activeAreaId || "commercial",
    activeTabId: persistedState?.activeTabId || HOME_TAB_ID,
    tabs: persistedState?.tabs?.length ? persistedState.tabs : [makeSystemTab("home")],
  });

  const activeArea = AREAS.find((area) => area.id === state.activeAreaId) || AREAS[0];
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0];
  const activeObjectDef = objectMap.get(activeTab?.objectApi);

  const visibleAreaObjects = useMemo(
    () => activeArea.objects.map((apiName) => objectMap.get(apiName)).filter(Boolean),
    [activeArea.objects, objectMap]
  );

  const availableMoreObjects = useMemo(
    () =>
      objectTabs.filter(
        (objectDef) => !activeArea.objects.includes(objectDef.apiName)
      ),
    [activeArea.objects, objectTabs]
  );

  useEffect(() => {
    if (!loaded || loading) return;
    dispatch({
      type: "SYNC",
      payload: {
        validApis: new Set(objectTabs.map((objectDef) => objectDef.apiName)),
        homeTab: makeSystemTab("home"),
      },
    });
  }, [loaded, loading, objectTabs]);

  useEffect(() => {
    writeState(storageKey, {
      activeAreaId: state.activeAreaId,
      activeTabId: state.activeTabId,
      tabs: state.tabs,
    });
  }, [state.activeAreaId, state.activeTabId, state.tabs, storageKey]);

  const openObject = useCallback((objectDef) => {
    dispatch({ type: "OPEN_LIST", payload: { objectDef } });
  }, []);

  const openRecord = useCallback((objectDef, record) => {
    dispatch({
      type: "OPEN_RECORD",
      payload: { objectApi: objectDef.apiName, tab: makeRecordTab(record, objectDef) },
    });
  }, []);

  const openEditRecord = useCallback((objectDef, record) => {
    dispatch({
      type: "OPEN_RECORD",
      payload: {
        objectApi: objectDef.apiName,
        tab: makeRecordTab(record, objectDef),
        startInEdit: true,
      },
    });
  }, []);

  const openLookupRecord = useCallback(
    (lookup) => {
      if (!lookup?.objectApi || !lookup?.recordId) return;
      const objectDef = objectMap.get(lookup.objectApi);
      if (!objectDef) return;
      dispatch({
        type: "OPEN_RECORD",
        payload: {
          objectApi: objectDef.apiName,
          tab: makeRecordTabFromLookup({
            objectApi: objectDef.apiName,
            recordId: lookup.recordId,
            label: lookup.label,
            objectDef,
          }),
        },
      });
    },
    [objectMap]
  );

  if (!loaded || loading) {
    return (
      <div className="rounded-lg border p-6" style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}>
        <p style={{ color: adminTheme.muted }}>Cargando workspace lab 2...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-96px)] overflow-hidden rounded-lg border"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div className="flex min-h-[calc(100vh-96px)]">
        <aside
          className="w-72 shrink-0 border-r px-4 py-5"
          style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border }}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
                Vitra Lab2
              </p>
              <h1 className="mt-1 text-lg font-semibold" style={{ color: adminTheme.text }}>
                Areas de trabajo
              </h1>
            </div>
            <FlaskConical className="h-5 w-5" style={{ color: adminTheme.text }} />
          </div>

          <div className="space-y-1">
            {AREAS.map((area) => (
              <AreaButton
                key={area.id}
                area={area}
                active={area.id === state.activeAreaId}
                onClick={() => dispatch({ type: "SET_AREA", payload: { areaId: area.id } })}
              />
            ))}
          </div>

          <div className="mt-6 border-t pt-4" style={{ borderColor: adminTheme.border }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: adminTheme.muted }}>
              Herramientas
            </p>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "OPEN_SYSTEM", payload: { type: "home" } })}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ color: adminTheme.text }}
              >
                <LayoutDashboard className="h-4 w-4" /> Inicio
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "OPEN_SYSTEM", payload: { type: "reports" } })}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ color: adminTheme.text }}
              >
                <ChartColumn className="h-4 w-4" /> Reportes
              </button>
              {activeArea.id === "catalog" ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "OPEN_SYSTEM", payload: { type: "priceReview" } })}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ color: adminTheme.text }}
                >
                  <BadgeDollarSign className="h-4 w-4" /> Revision precios
                </button>
              ) : null}
              <Link
                to="/admin/settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ color: adminTheme.text }}
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b px-5 py-4" style={{ borderColor: adminTheme.border }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
                  {activeArea.label}
                </p>
                <h2 className="mt-1 text-xl font-semibold" style={{ color: adminTheme.text }}>
                  {activeTab?.label || "Inicio"}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {visibleAreaObjects.map((objectDef) => (
                  <button
                    key={objectDef.apiName}
                    type="button"
                    onClick={() => openObject(objectDef)}
                    className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                  >
                    {objectDef.name}
                  </button>
                ))}
                {availableMoreObjects.length ? (
                  <select
                    className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                    value=""
                    onChange={(event) => {
                      const objectDef = objectMap.get(event.target.value);
                      if (objectDef) openObject(objectDef);
                    }}
                  >
                    <option value="">Mas objetos</option>
                    {availableMoreObjects.map((objectDef) => (
                      <option key={objectDef.apiName} value={objectDef.apiName}>
                        {objectDef.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          </header>

          <div className="border-b px-5" style={{ borderColor: adminTheme.border }}>
            <div className="flex gap-1 overflow-x-auto">
              {state.tabs.map((tab) => (
                <WorkTab
                  key={tab.id}
                  tab={tab}
                  active={tab.id === activeTab.id}
                  onFocus={() => dispatch({ type: "FOCUS_TAB", payload: { tabId: tab.id } })}
                  onClose={() => dispatch({ type: "CLOSE_TAB", payload: { tabId: tab.id } })}
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <section className="min-w-0 flex-1 overflow-y-auto p-5">
              {activeTab?.type === "home" ? (
                <HomePanel
                  salesObjectDef={objectMap.get("sales") || null}
                  onOpenSaleRecord={openRecord}
                />
              ) : activeTab?.type === "reports" ? (
                <ReportsViewer />
              ) : activeTab?.type === "priceReview" ? (
                <ReportsViewer initialReportApiName="price_review" />
              ) : activeTab?.type === "dashboards" ? (
                <DashboardsViewer />
              ) : activeTab?.type === "list" ? (
                <ListPanel
                  objectDef={activeObjectDef}
                  onOpenRecord={(record) => openRecord(activeObjectDef, record)}
                  onOpenEditRecord={(record) => openEditRecord(activeObjectDef, record)}
                  onOpenLookupRecord={openLookupRecord}
                />
              ) : activeTab?.type === "record" ? (
                <RecordWorkspace
                  objectDef={activeObjectDef}
                  tab={activeTab}
                  onActivateSubtab={(subtabId) =>
                    dispatch({ type: "ACTIVATE_SUBTAB", payload: { tabId: activeTab.id, subtabId } })
                  }
                  onCloseSubtab={(subtabId) =>
                    dispatch({ type: "CLOSE_SUBTAB", payload: { tabId: activeTab.id, subtabId } })
                  }
                  onOpenChild={(record, childObjectDef) =>
                    dispatch({ type: "OPEN_CHILD", payload: { tabId: activeTab.id, record, childObjectDef } })
                  }
                  onOpenLookupRecord={openLookupRecord}
                  onRecordSaved={(tabId, objectDef, updatedRecord) =>
                    dispatch({ type: "RECORD_SAVED", payload: { tabId, objectDef, updatedRecord } })
                  }
                  onRefreshRecord={(tabId) => dispatch({ type: "REFRESH_RECORD", payload: { tabId } })}
                  onStartEdit={(tabId) => dispatch({ type: "START_EDIT", payload: { tabId } })}
                  onCancelEdit={(tabId) => dispatch({ type: "CANCEL_EDIT", payload: { tabId } })}
                />
              ) : null}
            </section>
            <ContextPanel activeTab={activeTab} activeArea={activeArea} objectDef={activeObjectDef} />
          </div>
        </main>
      </div>
    </div>
  );
}

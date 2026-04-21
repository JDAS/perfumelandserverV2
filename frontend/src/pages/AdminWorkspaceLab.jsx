import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  ChartColumn,
  LayoutDashboard,
} from "lucide-react";
import { Link } from "react-router-dom";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ReportsViewer from "../components/admin/ReportsViewer";
import {
  ClassicTab,
  LauncherChip,
  WorkspaceHeader,
} from "../components/admin/workspaceLab/WorkspaceChrome";
import { ListPanel } from "../components/admin/workspaceLab/ListPanel";
import { RecordWorkspace } from "../components/admin/workspaceLab/RecordWorkspace";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { formatFieldValue } from "../engine/metadataEngine";
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getDefaultListView,
  getDetailFields,
  getListColumns,
} from "../engine/metadataEngine";
import { getRecordById, getRecords, getRelatedRecords } from "../services/customService";
import { useAuthStore } from "../store/authStore";
import { adminGradient, adminTheme } from "../theme/adminTheme";

const STORAGE_PREFIX = "admin-workspace-lab";

function readState(key) {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      activeObjectApi: typeof parsed?.activeObjectApi === "string" ? parsed.activeObjectApi : "",
      workspaces: parsed?.workspaces && typeof parsed.workspaces === "object" ? parsed.workspaces : {},
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
    // ignore
  }
}

function buildWorkspace(objectApi) {
  return {
    objectApi,
    activeTabId: "list",
    tabs: [{ id: "list", type: "list", label: "Lista", pinned: true }],
  };
}

function getRecordLabel(record, objectDef) {
  const directKeys = ["name", "title", "product_name", "customer_name", "client_name", "participant_name", "brand"];
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

function makeRecordTab(record, objectDef) {
  return {
    id: `record:${objectDef.apiName}:${record._id}`,
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: getRecordLabel(record, objectDef),
    activeSubtabId: "detail",
    subtabs: [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
  };
}

function makeChildSubtab(record, objectDef) {
  return {
    id: `child:${objectDef.apiName}:${record._id}`,
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: `${objectDef.name}: ${getRecordLabel(record, objectDef)}`,
    pinned: false,
  };
}

function TabChip({ active, label, onClick, onClose, closable = false, dark = false, small = false }) {
  return (
    <div
      className={`inline-flex items-center gap-2 border font-medium transition ${small ? "rounded-lg px-2.5 py-1.5 text-xs" : "rounded-xl px-3 py-2 text-sm"}`}
      style={
        active
          ? dark
            ? { background: "rgba(255,255,255,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.22)" }
            : { backgroundColor: adminTheme.surface, color: adminTheme.text, borderColor: adminTheme.border, boxShadow: "0 8px 20px rgba(17,24,39,0.08)" }
          : dark
            ? { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.72)", borderColor: "rgba(255,255,255,0.1)" }
            : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted, borderColor: adminTheme.border }
      }
    >
      <button type="button" onClick={onClick} className="text-left">{label}</button>
      {closable ? <button type="button" onClick={onClose} className="text-xs opacity-80 hover:opacity-100">x</button> : null}
    </div>
  );
}

function Card({ eyebrow, title, description, dark = false, right, children }) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={dark ? { background: adminGradient(), borderColor: "rgba(255,255,255,0.08)", color: "#fff" } : { background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFD 100%)", borderColor: adminTheme.border }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: dark ? "rgba(255,255,255,0.6)" : adminTheme.muted }}>{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold" style={{ color: dark ? "#fff" : adminTheme.text }}>{title}</h2>
          {description ? <p className="mt-1 text-sm" style={{ color: dark ? "rgba(255,255,255,0.75)" : adminTheme.muted }}>{description}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function ListPanel({ objectDef, onOpenRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const listView = useMemo(() => getDefaultListView(objectDef), [objectDef]);
  const columns = useMemo(() => getListColumns(objectDef, listView).slice(0, 6), [objectDef, listView]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await getRecords(objectDef.apiName, { page: 1, limit: 12, sortBy: "createdAt", sortOrder: "desc" });
        if (!cancelled) setRecords(data?.records || []);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [objectDef.apiName]);

  return (
    <div className="rounded-2xl border p-5 shadow-[0_16px_36px_rgba(17,24,39,0.06)]" style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: adminTheme.accentDeep }}>Lista activa</p>
      <h3 className="text-xl font-semibold" style={{ color: adminTheme.text }}>{objectDef.name}</h3>
      <p className="mb-4 text-sm" style={{ color: adminTheme.muted }}>Desde aqui se abren tabs de nivel 2 para registros individuales.</p>
      {loading ? <p style={{ color: adminTheme.muted }}>Cargando registros...</p> : records.length === 0 ? <p style={{ color: adminTheme.muted }}>No hay registros para mostrar.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm" style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }}>
                {columns.map((field) => <th key={field.apiName} className="border-b p-3" style={{ borderColor: adminTheme.border }}>{field.label}</th>)}
                <th className="border-b p-3" style={{ borderColor: adminTheme.border }}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  {columns.map((field) => <td key={field.apiName} className="border-b p-3 text-sm" style={{ borderColor: adminTheme.border, color: adminTheme.text }}>{formatFieldValue(field, record[field.apiName], record)}</td>)}
                  <td className="border-b p-3" style={{ borderColor: adminTheme.border }}>
                    <button type="button" onClick={() => onOpenRecord(record)} className="rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: adminGradient() }}>
                      Ver en tab
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <div key={field.apiName}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: adminTheme.muted }}>{field.label}</p>
          <div className="min-h-[46px] rounded-xl border p-3 text-sm" style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border, color: adminTheme.text }}>
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
  const columns = useMemo(() => (section.relatedColumns || []).map((apiName) => (relatedObjectDef?.fields || []).find((field) => field.apiName === apiName)).filter(Boolean).slice(0, 4), [relatedObjectDef, section.relatedColumns]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await getRelatedRecords(parentObjectApi, parentId, section.relatedObject, section.relatedField, { sortField: section.sortField || "", sortOrder: section.sortOrder || "desc" });
        if (!cancelled) setRecords(data?.records || []);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (section.relatedObject && section.relatedField) load();
    return () => { cancelled = true; };
  }, [parentId, parentObjectApi, section.relatedField, section.relatedObject, section.sortField, section.sortOrder]);

  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: "#FBFCFE", borderColor: adminTheme.border }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold" style={{ color: adminTheme.text }}>{section.label}</h4>
        <span className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted }}>Nivel 3</span>
      </div>
      {loading ? <p className="text-sm" style={{ color: adminTheme.muted }}>Cargando relacionados...</p> : records.length === 0 ? <p className="text-sm" style={{ color: adminTheme.muted }}>No hay relacionados.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm" style={{ backgroundColor: adminTheme.surfaceAlt }}>
                {columns.map((field) => <th key={field.apiName} className="border-b p-2" style={{ borderColor: adminTheme.border }}>{field.label}</th>)}
                <th className="border-b p-2" style={{ borderColor: adminTheme.border }}>Abrir</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  {columns.map((field) => <td key={field.apiName} className="border-b p-2 text-sm" style={{ borderColor: adminTheme.border, color: adminTheme.text }}>{formatFieldValue(field, record[field.apiName], record)}</td>)}
                  <td className="border-b p-2" style={{ borderColor: adminTheme.border }}>
                    <button type="button" disabled={!relatedObjectDef} onClick={() => relatedObjectDef && onOpenRecord(record, relatedObjectDef)} className="rounded-lg border px-3 py-1 text-sm font-medium disabled:opacity-60" style={{ borderColor: adminTheme.border, color: adminTheme.text }}>
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

function RecordView({ objectDef, recordId, allowChildren = false, onOpenChild }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const relatedSections = (objectDef.layout?.[0]?.sections || []).filter((section) => section.type === "relatedList");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await getRecordById(objectDef.apiName, recordId);
        if (!cancelled) setRecord(data);
      } catch {
        if (!cancelled) setRecord(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [objectDef.apiName, recordId]);

  if (loading) return <div className="rounded-2xl border p-5" style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}><p style={{ color: adminTheme.muted }}>Cargando detalle...</p></div>;
  if (!record) return <div className="rounded-2xl border p-5" style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}><p style={{ color: adminTheme.muted }}>No se pudo cargar el registro.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5" style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: adminTheme.accentDeep }}>{objectDef.name}</p>
            <h3 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.text }}>{getRecordLabel(record, objectDef)}</h3>
          </div>
          <span className="text-xs" style={{ color: adminTheme.muted }}>{record._id}</span>
        </div>
        <FieldGrid objectDef={objectDef} record={record} />
      </div>
      {allowChildren ? relatedSections.map((section, index) => <RelatedPanel key={`${section.apiName || "related"}-${index}`} parentObjectApi={objectDef.apiName} parentId={recordId} section={section} onOpenRecord={onOpenChild} />) : null}
    </div>
  );
}

function RecordArea({ objectDef, tab, onActivateSubtab, onCloseSubtab, onOpenChild }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const activeSubtab = tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) || tab.subtabs[0];
  const childObjectDef = activeSubtab.type === "record" ? getObjectByApiNameFromCache(activeSubtab.objectApi) || objectDef : objectDef;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F7FAFD 100%)", borderColor: adminTheme.border }}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: adminTheme.accentDeep }}>Nivel 3 local</p>
        <p className="text-sm font-medium" style={{ color: adminTheme.text }}>{objectDef.name} / {tab.label}</p>
        <p className="mb-3 text-xs" style={{ color: adminTheme.muted }}>Aqui viven el detalle del padre y los hijos abiertos desde sus listas relacionadas.</p>
        <div className="flex flex-wrap gap-2">
          {tab.subtabs.map((subtab) => (
            <TabChip key={subtab.id} active={subtab.id === activeSubtab.id} label={subtab.label} onClick={() => onActivateSubtab(subtab.id)} onClose={() => onCloseSubtab(subtab.id)} closable={!subtab.pinned} small />
          ))}
        </div>
      </div>
      {activeSubtab.type === "detail" ? <RecordView objectDef={objectDef} recordId={tab.recordId} allowChildren onOpenChild={onOpenChild} /> : <RecordView objectDef={childObjectDef} recordId={activeSubtab.recordId} />}
    </div>
  );
}

function AdminWorkspaceLab() {
  const { objects, loading, loaded } = useObjectMetadata();
  const user = useAuthStore((state) => state.user);
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${user?._id || user?.email || "default"}`, [user?._id, user?.email]);
  const [activeObjectApi, setActiveObjectApi] = useState("");
  const [workspaces, setWorkspaces] = useState({});
  const [restored, setRestored] = useState(false);

  const objectTabs = useMemo(() => objects.filter((obj) => obj.active !== false && obj.tabsEnabled !== false), [objects]);

  useEffect(() => {
    const persisted = readState(storageKey);
    setActiveObjectApi(persisted?.activeObjectApi || "");
    setWorkspaces(persisted?.workspaces || {});
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!restored || !objectTabs.length) return;
    const validApis = new Set(objectTabs.map((objectDef) => objectDef.apiName));
    setActiveObjectApi((current) => (current && validApis.has(current) ? current : objectTabs[0].apiName));
    setWorkspaces((current) => {
      const next = { ...current };
      for (const objectDef of objectTabs) {
        if (!next[objectDef.apiName]) next[objectDef.apiName] = buildWorkspace(objectDef.apiName);
      }
      Object.keys(next).forEach((apiName) => { if (!validApis.has(apiName)) delete next[apiName]; });
      return next;
    });
  }, [objectTabs, restored]);

  useEffect(() => {
    if (!restored) return;
    writeState(storageKey, { activeObjectApi, workspaces });
  }, [activeObjectApi, restored, storageKey, workspaces]);

  const activeObjectDef = objectTabs.find((objectDef) => objectDef.apiName === activeObjectApi);
  const activeWorkspace = activeObjectApi ? workspaces[activeObjectApi] : null;
  const activeLevelTwoTab = activeWorkspace?.tabs.find((tab) => tab.id === activeWorkspace.activeTabId) || activeWorkspace?.tabs?.[0] || null;

  const openObjectWorkspace = useCallback((objectDef) => {
    setActiveObjectApi(objectDef.apiName);
    setWorkspaces((current) => ({ ...current, [objectDef.apiName]: current[objectDef.apiName] || buildWorkspace(objectDef.apiName) }));
  }, []);

  const openRecordAtLevelTwo = useCallback((objectDef, record) => {
    const nextTab = makeRecordTab(record, objectDef);
    setActiveObjectApi(objectDef.apiName);
    setWorkspaces((current) => {
      const workspace = current[objectDef.apiName] || buildWorkspace(objectDef.apiName);
      return {
        ...current,
        [objectDef.apiName]: {
          ...workspace,
          activeTabId: nextTab.id,
          tabs: workspace.tabs.some((tab) => tab.id === nextTab.id) ? workspace.tabs : [...workspace.tabs, nextTab],
        },
      };
    });
  }, []);

  const activateLevelTwoTab = useCallback((objectApi, tabId) => {
    setWorkspaces((current) => ({ ...current, [objectApi]: { ...(current[objectApi] || buildWorkspace(objectApi)), activeTabId: tabId } }));
  }, []);

  const closeLevelTwoTab = useCallback((objectApi, tabId) => {
    setWorkspaces((current) => {
      const workspace = current[objectApi];
      if (!workspace) return current;
      const tabs = workspace.tabs.filter((tab) => tab.id !== tabId);
      return {
        ...current,
        [objectApi]: {
          ...workspace,
          tabs: tabs.length ? tabs : buildWorkspace(objectApi).tabs,
          activeTabId: workspace.activeTabId === tabId ? (tabs[tabs.length - 1]?.id || "list") : workspace.activeTabId,
        },
      };
    });
  }, []);

  const openChildAtLevelThree = useCallback((objectApi, levelTwoTabId, record, childObjectDef) => {
    const childSubtab = makeChildSubtab(record, childObjectDef);
    setWorkspaces((current) => {
      const workspace = current[objectApi];
      if (!workspace) return current;
      return {
        ...current,
        [objectApi]: {
          ...workspace,
          tabs: workspace.tabs.map((tab) => {
            if (tab.id !== levelTwoTabId || tab.type !== "record") return tab;
            return {
              ...tab,
              activeSubtabId: childSubtab.id,
              subtabs: tab.subtabs.some((subtab) => subtab.id === childSubtab.id) ? tab.subtabs : [...tab.subtabs, childSubtab],
            };
          }),
        },
      };
    });
  }, []);

  const activateLevelThreeTab = useCallback((objectApi, levelTwoTabId, subtabId) => {
    setWorkspaces((current) => ({
      ...current,
      [objectApi]: {
        ...current[objectApi],
        tabs: current[objectApi].tabs.map((tab) => tab.id === levelTwoTabId && tab.type === "record" ? { ...tab, activeSubtabId: subtabId } : tab),
      },
    }));
  }, []);

  const closeLevelThreeTab = useCallback((objectApi, levelTwoTabId, subtabId) => {
    setWorkspaces((current) => ({
      ...current,
      [objectApi]: {
        ...current[objectApi],
        tabs: current[objectApi].tabs.map((tab) => {
          if (tab.id !== levelTwoTabId || tab.type !== "record") return tab;
          const subtabs = tab.subtabs.filter((subtab) => subtab.id !== subtabId);
          return {
            ...tab,
            subtabs: subtabs.length ? subtabs : [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
            activeSubtabId: tab.activeSubtabId === subtabId ? (subtabs[subtabs.length - 1]?.id || "detail") : tab.activeSubtabId,
          };
        }),
      },
    }));
  }, []);

  if (!restored || !loaded || loading) {
    return <div className="rounded-[28px] p-6 shadow-[0_20px_56px_rgba(17,24,39,0.18)]" style={{ backgroundColor: adminTheme.surface }}><p style={{ color: adminTheme.muted }}>Cargando lab de navegacion...</p></div>;
  }

  if (!objectTabs.length || !activeObjectDef || !activeWorkspace || !activeLevelTwoTab) {
    return <div className="rounded-[28px] p-6 shadow-[0_20px_56px_rgba(17,24,39,0.18)]" style={{ backgroundColor: adminTheme.surface }}><p style={{ color: adminTheme.muted }}>No hay objetos disponibles para probar el lab.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] px-6 py-6 text-white shadow-[0_20px_56px_rgba(17,24,39,0.18)]" style={{ background: adminGradient() }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">Workspace Lab</p>
            <h1 className="mt-2 text-3xl font-bold">Prueba de navegacion multinivel</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/75">Nivel 1 por objetos, nivel 2 por lista y registros abiertos, y nivel 3 local para hijos relacionados dentro del registro activo.</p>
          </div>
          <Link to="/admin" className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">Volver al admin actual</Link>
        </div>
      </div>

      <Card dark eyebrow="Nivel 1 · Objetos" title="Objetos principales" description="Cada objeto conserva su propio workspace aunque cambies a otro." right={<span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">Persiste al refrescar</span>}>
        <div className="flex flex-wrap gap-2">
          {objectTabs.map((objectDef) => <TabChip key={objectDef.apiName} active={objectDef.apiName === activeObjectApi} label={objectDef.name} onClick={() => openObjectWorkspace(objectDef)} dark />)}
        </div>
      </Card>

      <Card eyebrow={`Nivel 2 · Workspace de ${activeObjectDef.name}`} title="Tabs del objeto activo" description="La lista vive como tab fijo y los registros abiertos quedan al lado." right={<div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }}>{activeWorkspace.tabs.length} tabs abiertos</div>}>
        <div className="flex flex-wrap gap-2">
          {activeWorkspace.tabs.map((tab) => <TabChip key={tab.id} active={tab.id === activeWorkspace.activeTabId} label={tab.label} onClick={() => activateLevelTwoTab(activeObjectApi, tab.id)} onClose={() => closeLevelTwoTab(activeObjectApi, tab.id)} closable={!tab.pinned} />)}
        </div>
      </Card>

      <Card eyebrow="Area de trabajo" title={activeLevelTwoTab.type === "list" ? `${activeObjectDef.name} · Lista` : `${activeObjectDef.name} · ${activeLevelTwoTab.label}`} description={activeLevelTwoTab.type === "list" ? "Abre registros para sentir el cambio a nivel 2." : "Este registro ya puede abrir hijos en un nivel 3 local."} right={activeLevelTwoTab.type === "record" ? <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted }}>Nivel 3 disponible</div> : null}>
        {activeLevelTwoTab.type === "list" ? <ListPanel objectDef={activeObjectDef} onOpenRecord={(record) => openRecordAtLevelTwo(activeObjectDef, record)} /> : <RecordArea objectDef={activeObjectDef} tab={activeLevelTwoTab} onActivateSubtab={(subtabId) => activateLevelThreeTab(activeObjectApi, activeLevelTwoTab.id, subtabId)} onCloseSubtab={(subtabId) => closeLevelThreeTab(activeObjectApi, activeLevelTwoTab.id, subtabId)} onOpenChild={(record, childObjectDef) => openChildAtLevelThree(activeObjectApi, activeLevelTwoTab.id, record, childObjectDef)} />}
      </Card>
    </div>
  );
}

export default AdminWorkspaceLab;

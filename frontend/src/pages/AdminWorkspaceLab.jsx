import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getDefaultListView,
  getDetailFields,
  getListColumns,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../engine/metadataEngine";
import {
  getRecordById,
  getRecords,
  getRelatedRecords,
} from "../services/customService";
import { adminGradient, adminTheme } from "../theme/adminTheme";

function buildWorkspace(objectApi) {
  return {
    activeTabId: "list",
    tabs: [
      {
        id: "list",
        type: "list",
        label: "Lista",
        pinned: true,
      },
    ],
  };
}

function getRecordLabel(record, objectDef) {
  if (!record) return "Registro";

  const preferredKeys = [
    "name",
    "title",
    "product_name",
    "customer_name",
    "client_name",
    "participant_name",
    "brand",
  ];

  for (const key of preferredKeys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const candidateFields = objectDef?.fields || [];
  for (const field of candidateFields) {
    const formatted = formatFieldValue(field, record[field.apiName], record);
    if (formatted && formatted !== "-") {
      return formatted;
    }
  }

  return `${objectDef?.name || "Registro"} ${String(record._id || "").slice(-6)}`;
}

function buildRecordTab(record, objectDef) {
  return {
    id: `record:${objectDef.apiName}:${record._id}`,
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: getRecordLabel(record, objectDef),
    subtabs: [
      {
        id: "detail",
        type: "detail",
        label: "Detalle",
        pinned: true,
      },
    ],
    activeSubtabId: "detail",
  };
}

function buildChildSubtab(record, objectDef) {
  return {
    id: `child:${objectDef.apiName}:${record._id}`,
    type: "record",
    objectApi: objectDef.apiName,
    recordId: record._id,
    label: `${objectDef.name}: ${getRecordLabel(record, objectDef)}`,
    pinned: false,
  };
}

function WorkspaceTabButton({
  active,
  label,
  onClick,
  onClose,
  closable = false,
  tone = "light",
}) {
  const activeStyles =
    tone === "dark"
      ? {
          background: "rgba(255,255,255,0.14)",
          color: "#fff",
          borderColor: "rgba(255,255,255,0.18)",
        }
      : {
          backgroundColor: adminTheme.surface,
          color: adminTheme.text,
          borderColor: adminTheme.border,
          boxShadow: "0 8px 20px rgba(17,24,39,0.08)",
        };

  const inactiveStyles =
    tone === "dark"
      ? {
          backgroundColor: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.72)",
          borderColor: "rgba(255,255,255,0.08)",
        }
      : {
          backgroundColor: adminTheme.surfaceAlt,
          color: adminTheme.muted,
          borderColor: "transparent",
        };

  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
      style={active ? activeStyles : inactiveStyles}
    >
      <button type="button" onClick={onClick} className="text-left">
        {label}
      </button>
      {closable ? (
        <button
          type="button"
          onClick={onClose}
          className="text-xs opacity-80 transition hover:opacity-100"
          aria-label={`Cerrar ${label}`}
          title={`Cerrar ${label}`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function WorkspaceListTab({ objectDef, onOpenRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const listView = useMemo(() => getDefaultListView(objectDef), [objectDef]);
  const columns = useMemo(
    () => getListColumns(objectDef, listView).slice(0, 6),
    [objectDef, listView]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
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
      } catch (error) {
        console.error("Error cargando registros del lab:", error);
        if (!cancelled) {
          setRecords([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => {
      cancelled = true;
    };
  }, [objectDef.apiName]);

  return (
    <div
      className="rounded-2xl border p-5 shadow-[0_16px_36px_rgba(17,24,39,0.06)]"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: adminTheme.text }}>
            {objectDef.name}
          </h3>
          <p className="text-sm" style={{ color: adminTheme.muted }}>
            Vista de lista experimental para probar apertura por tabs.
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: adminTheme.muted }}>Cargando registros...</p>
      ) : records.length === 0 ? (
        <p style={{ color: adminTheme.muted }}>No hay registros para mostrar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr
                className="text-left text-sm"
                style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }}
              >
                {columns.map((field) => (
                  <th key={field.apiName} className="border-b p-3" style={{ borderColor: adminTheme.border }}>
                    {field.label}
                  </th>
                ))}
                <th className="border-b p-3" style={{ borderColor: adminTheme.border }}>
                  Accion
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id} className="align-top">
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
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                      style={{ background: adminGradient() }}
                    >
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

function RecordFields({ objectDef, record }) {
  const activeLayout = objectDef.layout?.[0];
  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );

  const renderField = (field) => (
    <div key={field.apiName} className="mb-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: adminTheme.muted }}>
        {field.label}
      </p>
      <div
        className="min-h-[46px] rounded-xl border p-3 text-sm"
        style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border, color: adminTheme.text }}
      >
        {formatFieldValue(field, record?.[field.apiName], record)}
      </div>
    </div>
  );

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return (
        <div
          key={`${item}-${index}`}
          className="h-[72px] rounded-xl border border-dashed"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surfaceAlt }}
        />
      );
    }

    const field = (objectDef.fields || []).find((candidate) => candidate.apiName === item);
    if (!field || field.visibleInDetail === false) return null;
    return renderField(field);
  };

  if (fieldSections.length > 0) {
    return (
      <div className="space-y-6">
        {fieldSections.map((section, index) => {
          const { col1, col2 } = splitFieldsIntoColumns(section.fields || []);
          const hasLabel = Boolean(String(section.label || "").trim());

          return (
            <section key={`${section.apiName || "section"}-${index}`}>
              {hasLabel ? (
                <h4 className="mb-4 text-lg font-semibold" style={{ color: adminTheme.text }}>
                  {section.label}
                </h4>
              ) : null}

              {section.columns === 2 ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>{col1.map((item, itemIndex) => renderFieldOrBlank(item, itemIndex))}</div>
                  <div>{col2.map((item, itemIndex) => renderFieldOrBlank(item, itemIndex))}</div>
                </div>
              ) : (
                <div>{(section.fields || []).map((item, itemIndex) => renderFieldOrBlank(item, itemIndex))}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  const detailFields = getDetailFields(objectDef);
  return <div>{detailFields.map((field) => renderField(field))}</div>;
}

function RelatedRecordsPanel({ parentObjectApi, parentId, section, onOpenRecord }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const relatedObjectDef = getObjectByApiNameFromCache(section.relatedObject);
  const columns = useMemo(() => {
    return (section.relatedColumns || [])
      .map((apiName) =>
        (relatedObjectDef?.fields || []).find((field) => field.apiName === apiName)
      )
      .filter(Boolean)
      .slice(0, 4);
  }, [relatedObjectDef, section.relatedColumns]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelated() {
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
      } catch (error) {
        console.error("Error cargando relacionados del lab:", error);
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
      loadRelated();
    }

    return () => {
      cancelled = true;
    };
  }, [
    parentObjectApi,
    parentId,
    section.relatedField,
    section.relatedObject,
    section.sortField,
    section.sortOrder,
  ]);

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold" style={{ color: adminTheme.text }}>
          {section.label}
        </h4>
        <span className="text-xs uppercase tracking-[0.18em]" style={{ color: adminTheme.muted }}>
          Nivel 3
        </span>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: adminTheme.muted }}>
          Cargando relacionados...
        </p>
      ) : records.length === 0 ? (
        <p className="text-sm" style={{ color: adminTheme.muted }}>
          No hay relacionados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm" style={{ backgroundColor: adminTheme.surfaceAlt }}>
                {columns.map((field) => (
                  <th key={field.apiName} className="border-b p-2" style={{ borderColor: adminTheme.border }}>
                    {field.label}
                  </th>
                ))}
                <th className="border-b p-2" style={{ borderColor: adminTheme.border }}>
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
                      onClick={() => {
                        if (relatedObjectDef) {
                          onOpenRecord(record, relatedObjectDef);
                        }
                      }}
                      disabled={!relatedObjectDef}
                      className="rounded-lg border px-3 py-1 text-sm font-medium"
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

function EmbeddedRecordView({
  objectDef,
  recordId,
  allowChildren = false,
  onOpenChild,
}) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRecord() {
      try {
        setLoading(true);
        const data = await getRecordById(objectDef.apiName, recordId);
        if (!cancelled) {
          setRecord(data);
        }
      } catch (error) {
        console.error("Error cargando registro embebido:", error);
        if (!cancelled) {
          setRecord(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecord();

    return () => {
      cancelled = true;
    };
  }, [objectDef.apiName, recordId]);

  const activeLayout = objectDef.layout?.[0];
  const relatedSections = (activeLayout?.sections || []).filter(
    (section) => section.type === "relatedList"
  );

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
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: adminTheme.muted }}>
              {objectDef.name}
            </p>
            <h3 className="text-2xl font-semibold" style={{ color: adminTheme.text }}>
              {getRecordLabel(record, objectDef)}
            </h3>
          </div>
          <span className="text-xs" style={{ color: adminTheme.muted }}>
            {record._id}
          </span>
        </div>
        <RecordFields objectDef={objectDef} record={record} />
      </div>

      {allowChildren
        ? relatedSections.map((section, index) => (
            <RelatedRecordsPanel
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

function RecordWorkspace({
  objectDef,
  tab,
  onActivateSubtab,
  onCloseSubtab,
  onOpenChild,
}) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const activeSubtab =
    tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) || tab.subtabs[0];

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-3"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: adminTheme.text }}>
              Nivel 3 dentro de {tab.label}
            </p>
            <p className="text-xs" style={{ color: adminTheme.muted }}>
              Detalle del padre y registros hijos abiertos desde sus listas relacionadas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tab.subtabs.map((subtab) => (
            <WorkspaceTabButton
              key={subtab.id}
              active={subtab.id === activeSubtab.id}
              label={subtab.label}
              onClick={() => onActivateSubtab(subtab.id)}
              onClose={() => onCloseSubtab(subtab.id)}
              closable={!subtab.pinned}
            />
          ))}
        </div>
      </div>

      {activeSubtab.type === "detail" ? (
        <EmbeddedRecordView
          objectDef={objectDef}
          recordId={tab.recordId}
          allowChildren
          onOpenChild={onOpenChild}
        />
      ) : (
        <EmbeddedRecordView
          objectDef={getObjectByApiNameFromCache(activeSubtab.objectApi) || objectDef}
          recordId={activeSubtab.recordId}
        />
      )}
    </div>
  );
}

function AdminWorkspaceLab() {
  const { objects, loading, loaded } = useObjectMetadata();
  const [activeObjectApi, setActiveObjectApi] = useState("");
  const [workspaces, setWorkspaces] = useState({});

  const objectTabs = useMemo(
    () => objects.filter((obj) => obj.active !== false && obj.tabsEnabled !== false),
    [objects]
  );

  useEffect(() => {
    if (!objectTabs.length) return;

    setActiveObjectApi((current) => current || objectTabs[0].apiName);
    setWorkspaces((current) => {
      const next = { ...current };
      for (const objectDef of objectTabs) {
        if (!next[objectDef.apiName]) {
          next[objectDef.apiName] = buildWorkspace(objectDef.apiName);
        }
      }
      return next;
    });
  }, [objectTabs]);

  const activeObjectDef = objectTabs.find((objectDef) => objectDef.apiName === activeObjectApi);
  const activeWorkspace = activeObjectApi ? workspaces[activeObjectApi] : null;
  const activeLevelTwoTab =
    activeWorkspace?.tabs.find((tab) => tab.id === activeWorkspace.activeTabId) ||
    activeWorkspace?.tabs?.[0] ||
    null;

  const openObjectWorkspace = useCallback((objectDef) => {
    setActiveObjectApi(objectDef.apiName);
    setWorkspaces((current) => ({
      ...current,
      [objectDef.apiName]: current[objectDef.apiName] || buildWorkspace(objectDef.apiName),
    }));
  }, []);

  const openRecordAtLevelTwo = useCallback((objectDef, record) => {
    const recordTab = buildRecordTab(record, objectDef);

    setActiveObjectApi(objectDef.apiName);
    setWorkspaces((current) => {
      const workspace = current[objectDef.apiName] || buildWorkspace(objectDef.apiName);
      const existing = workspace.tabs.find((tab) => tab.id === recordTab.id);

      return {
        ...current,
        [objectDef.apiName]: {
          ...workspace,
          activeTabId: recordTab.id,
          tabs: existing
            ? workspace.tabs
            : [...workspace.tabs, recordTab],
        },
      };
    });
  }, []);

  const activateLevelTwoTab = useCallback((objectApi, tabId) => {
    setWorkspaces((current) => ({
      ...current,
      [objectApi]: {
        ...(current[objectApi] || buildWorkspace(objectApi)),
        activeTabId: tabId,
      },
    }));
  }, []);

  const closeLevelTwoTab = useCallback((objectApi, tabId) => {
    setWorkspaces((current) => {
      const workspace = current[objectApi];
      if (!workspace) return current;

      const nextTabs = workspace.tabs.filter((tab) => tab.id !== tabId);
      const nextActive =
        workspace.activeTabId === tabId
          ? nextTabs[nextTabs.length - 1]?.id || "list"
          : workspace.activeTabId;

      return {
        ...current,
        [objectApi]: {
          ...workspace,
          tabs: nextTabs.length ? nextTabs : buildWorkspace(objectApi).tabs,
          activeTabId: nextActive,
        },
      };
    });
  }, []);

  const openChildAtLevelThree = useCallback((objectApi, levelTwoTabId, record, childObjectDef) => {
    const childSubtab = buildChildSubtab(record, childObjectDef);

    setWorkspaces((current) => {
      const workspace = current[objectApi];
      if (!workspace) return current;

      return {
        ...current,
        [objectApi]: {
          ...workspace,
          tabs: workspace.tabs.map((tab) => {
            if (tab.id !== levelTwoTabId || tab.type !== "record") {
              return tab;
            }

            const existing = tab.subtabs.find((subtab) => subtab.id === childSubtab.id);

            return {
              ...tab,
              activeSubtabId: childSubtab.id,
              subtabs: existing ? tab.subtabs : [...tab.subtabs, childSubtab],
            };
          }),
        },
      };
    });
  }, []);

  const activateLevelThreeTab = useCallback((objectApi, levelTwoTabId, subtabId) => {
    setWorkspaces((current) => {
      const workspace = current[objectApi];
      if (!workspace) return current;

      return {
        ...current,
        [objectApi]: {
          ...workspace,
          tabs: workspace.tabs.map((tab) =>
            tab.id === levelTwoTabId && tab.type === "record"
              ? { ...tab, activeSubtabId: subtabId }
              : tab
          ),
        },
      };
    });
  }, []);

  const closeLevelThreeTab = useCallback((objectApi, levelTwoTabId, subtabId) => {
    setWorkspaces((current) => {
      const workspace = current[objectApi];
      if (!workspace) return current;

      return {
        ...current,
        [objectApi]: {
          ...workspace,
          tabs: workspace.tabs.map((tab) => {
            if (tab.id !== levelTwoTabId || tab.type !== "record") {
              return tab;
            }

            const nextSubtabs = tab.subtabs.filter((subtab) => subtab.id !== subtabId);
            const nextActive =
              tab.activeSubtabId === subtabId
                ? nextSubtabs[nextSubtabs.length - 1]?.id || "detail"
                : tab.activeSubtabId;

            return {
              ...tab,
              subtabs: nextSubtabs.length ? nextSubtabs : [{ id: "detail", type: "detail", label: "Detalle", pinned: true }],
              activeSubtabId: nextActive,
            };
          }),
        },
      };
    });
  }, []);

  if (!loaded || loading) {
    return (
      <div
        className="rounded-[28px] p-6 shadow-[0_20px_56px_rgba(17,24,39,0.18)]"
        style={{ backgroundColor: adminTheme.surface }}
      >
        <p style={{ color: adminTheme.muted }}>Cargando lab de navegacion...</p>
      </div>
    );
  }

  if (!objectTabs.length || !activeObjectDef || !activeWorkspace || !activeLevelTwoTab) {
    return (
      <div
        className="rounded-[28px] p-6 shadow-[0_20px_56px_rgba(17,24,39,0.18)]"
        style={{ backgroundColor: adminTheme.surface }}
      >
        <p style={{ color: adminTheme.muted }}>
          No hay objetos disponibles para probar el lab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-[28px] px-6 py-6 text-white shadow-[0_20px_56px_rgba(17,24,39,0.18)]"
        style={{ background: adminGradient() }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">
              Workspace Lab
            </p>
            <h1 className="mt-2 text-3xl font-bold">Prueba de navegacion multinivel</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/75">
              Nivel 1 por objetos, nivel 2 por lista y registros abiertos, y nivel 3 local
              para hijos relacionados dentro del registro activo.
            </p>
          </div>

          <Link
            to="/admin"
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Volver al admin actual
          </Link>
        </div>
      </div>

      <section
        className="rounded-2xl border p-3"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p className="mb-3 text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
          Nivel 1 · Objetos
        </p>
        <div className="flex flex-wrap gap-2">
          {objectTabs.map((objectDef) => (
            <WorkspaceTabButton
              key={objectDef.apiName}
              active={objectDef.apiName === activeObjectApi}
              label={objectDef.name}
              onClick={() => openObjectWorkspace(objectDef)}
              tone="light"
            />
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border p-3"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p className="mb-3 text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
          Nivel 2 · Workspace de {activeObjectDef.name}
        </p>
        <div className="flex flex-wrap gap-2">
          {activeWorkspace.tabs.map((tab) => (
            <WorkspaceTabButton
              key={tab.id}
              active={tab.id === activeWorkspace.activeTabId}
              label={tab.label}
              onClick={() => activateLevelTwoTab(activeObjectApi, tab.id)}
              onClose={() => closeLevelTwoTab(activeObjectApi, tab.id)}
              closable={!tab.pinned}
            />
          ))}
        </div>
      </section>

      {activeLevelTwoTab.type === "list" ? (
        <WorkspaceListTab
          objectDef={activeObjectDef}
          onOpenRecord={(record) => openRecordAtLevelTwo(activeObjectDef, record)}
        />
      ) : (
        <RecordWorkspace
          objectDef={activeObjectDef}
          tab={activeLevelTwoTab}
          onActivateSubtab={(subtabId) =>
            activateLevelThreeTab(activeObjectApi, activeLevelTwoTab.id, subtabId)
          }
          onCloseSubtab={(subtabId) =>
            closeLevelThreeTab(activeObjectApi, activeLevelTwoTab.id, subtabId)
          }
          onOpenChild={(record, childObjectDef) =>
            openChildAtLevelThree(
              activeObjectApi,
              activeLevelTwoTab.id,
              record,
              childObjectDef
            )
          }
        />
      )}
    </div>
  );
}

export default AdminWorkspaceLab;

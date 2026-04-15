import { useEffect, useMemo, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
} from "@hello-pangea/dnd";
import { Link, useSearchParams } from "react-router-dom";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ObjectListView from "../components/ObjectListView";
import ReportsViewer from "../components/admin/ReportsViewer";
import SuiteSetupPanel from "../components/SuiteSetupPanel";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { updatePreferences } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { adminGradient, adminTheme } from "../theme/adminTheme";

function Admin() {
  const { objects, loading, loaded, error, refreshObjects } = useObjectMetadata();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [savingOrder, setSavingOrder] = useState(false);

  const activeTab = searchParams.get("tab");

  const availableTabs = useMemo(
    () => [
      ...objects
        .filter((obj) => obj.active !== false && obj.tabsEnabled !== false)
        .map((obj) => ({
          id: obj.apiName,
          label: obj.name,
          type: "object",
          object: obj,
        })),
      { id: "reportes", label: "Reportes", type: "system" },
      { id: "dashboards", label: "Dashboards", type: "system" },
    ],
    [objects]
  );

  const tabs = useMemo(() => {
    const preferredOrder = Array.isArray(user?.adminTabOrder)
      ? user.adminTabOrder
      : [];

    if (!preferredOrder.length) {
      return availableTabs;
    }

    const byId = new Map(availableTabs.map((tab) => [tab.id, tab]));
    const ordered = preferredOrder.map((id) => byId.get(id)).filter(Boolean);
    const remaining = availableTabs.filter((tab) => !preferredOrder.includes(tab.id));

    return [...ordered, ...remaining];
  }, [availableTabs, user?.adminTabOrder]);

  useEffect(() => {
    if (loading) return;
    if (!activeTab && tabs.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tabs[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [loading, activeTab, tabs, searchParams, setSearchParams]);

  const currentTab = tabs.find((tab) => tab.id === activeTab);

  const handleTabChange = (tabId) => {
    const next = new URLSearchParams();
    next.set("tab", tabId);
    if (tabId !== "reportes" && tabId !== "dashboards") {
      next.set("view", "all");
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const persistTabOrder = async (nextTabs) => {
    const nextOrder = nextTabs.map((tab) => tab.id);
    setSavingOrder(true);
    try {
      const data = await updatePreferences({ adminTabOrder: nextOrder });
      if (data?.user) {
        updateUser(data.user);
      }
    } catch (error) {
      console.error("No se pudo guardar el orden de tabs", error);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination } = result;

    if (!destination || savingOrder) return;
    if (source.index === destination.index) return;

    const nextTabs = [...tabs];
    const [movedTab] = nextTabs.splice(source.index, 1);
    nextTabs.splice(destination.index, 0, movedTab);

    await persistTabOrder(nextTabs);
  };

  const renderContent = () => {
    if (!currentTab) {
      return (
        <div
          className="rounded-2xl p-6 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
          style={{ backgroundColor: adminTheme.surface }}
        >
          <p style={{ color: adminTheme.muted }}>No hay contenido disponible.</p>
        </div>
      );
    }

    if (currentTab.type === "object") {
      return <ObjectListView objectDef={currentTab.object} />;
    }

    if (currentTab.id === "reportes") {
      return <ReportsViewer />;
    }

    if (currentTab.id === "dashboards") {
      return <DashboardsViewer />;
    }

    return (
      <div
        className="rounded-2xl p-6 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
        style={{ backgroundColor: adminTheme.surface }}
      >
        <p style={{ color: adminTheme.muted }}>No hay contenido disponible.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div
        className="rounded-[28px] px-6 py-6 text-white shadow-[0_20px_56px_rgba(17,24,39,0.18)]"
        style={{ background: adminGradient() }}
      >
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="mt-1 text-sm text-white/75">
          Accesos por objeto y visualizadores internos del sistema.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-white/55">
          Arrastra los tabs a tu gusto. El orden queda guardado en tu usuario.
        </p>
        <div className="mt-4">
          <Link
            to="/admin/workspace-lab"
            className="inline-flex rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Probar workspace lab
          </Link>
        </div>
      </div>

      {!loaded || loading ? (
        <div
          className="rounded-2xl p-6 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
          style={{ backgroundColor: adminTheme.surface }}
        >
          <p>Cargando objetos del admin...</p>
        </div>
      ) : error ? (
        <div
          className="rounded-2xl p-6 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
          style={{ backgroundColor: adminTheme.surface }}
        >
          <p className="font-medium" style={{ color: adminTheme.text }}>
            No se pudieron cargar los objetos del admin.
          </p>
          <p className="mt-2 text-sm" style={{ color: adminTheme.muted }}>
            Vamos bien: esto no significa que falte instalar la suite. Solo falló la carga de metadata.
          </p>
          <button
            type="button"
            onClick={() => refreshObjects().catch(() => {})}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: adminGradient() }}
          >
            Reintentar
          </button>
        </div>
      ) : objects.length === 0 ? (
        <SuiteSetupPanel
          onInstalled={async () => {
            const installedObjects = await refreshObjects();
            const firstObject = (installedObjects || [])
              .filter((obj) => obj.active !== false && obj.tabsEnabled !== false)
              .sort((a, b) => a.name.localeCompare(b.name))[0];

            if (firstObject) {
              const next = new URLSearchParams();
              next.set("tab", firstObject.apiName);
              next.set("view", "all");
              next.set("page", "1");
              setSearchParams(next, { replace: true });
            }
          }}
        />
      ) : (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="admin-tabs" direction="horizontal">
              {(providedDroppable) => (
                <div
                  ref={providedDroppable.innerRef}
                  {...providedDroppable.droppableProps}
                  className="flex gap-2 overflow-x-auto rounded-2xl p-2 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
                  style={{ backgroundColor: adminTheme.surface }}
                >
                  {tabs.map((tab, index) => (
                    <Draggable key={tab.id} draggableId={tab.id} index={index}>
                      {(providedDraggable, snapshot) => (
                        <div
                          ref={providedDraggable.innerRef}
                          {...providedDraggable.draggableProps}
                          {...providedDraggable.dragHandleProps}
                          className="min-w-fit rounded-xl p-1"
                          style={{
                            ...(activeTab === tab.id
                              ? {
                                  background: adminGradient(),
                                  color: "#fff",
                                  boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
                                }
                              : {
                                  backgroundColor: adminTheme.surfaceAlt,
                                  color: adminTheme.text,
                                }),
                            opacity: savingOrder ? 0.7 : 1,
                            ...(snapshot.isDragging
                              ? {
                                  boxShadow: "0 16px 38px rgba(17,24,39,0.22)",
                                }
                              : {}),
                            ...providedDraggable.draggableProps.style,
                          }}
                        >
                          <button
                            onClick={() => handleTabChange(tab.id)}
                            className="rounded-lg px-4 py-2 text-sm font-medium transition"
                            style={{ color: "inherit", cursor: "pointer" }}
                          >
                            {tab.label}
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {providedDroppable.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {renderContent()}
        </>
      )}
    </div>
  );
}

export default Admin;

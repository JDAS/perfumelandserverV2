import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ObjectListView from "../components/ObjectListView";
import ReportsViewer from "../components/admin/ReportsViewer";
import SuiteSetupPanel from "../components/SuiteSetupPanel";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { updatePreferences } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { adminGradient, adminTheme } from "../theme/adminTheme";

function Admin() {
  const { objects, loading, refreshObjects } = useObjectMetadata();
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
    const ordered = preferredOrder
      .map((id) => byId.get(id))
      .filter(Boolean);
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

  const moveTab = async (tabId, direction) => {
    if (savingOrder) return;

    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex === -1) return;

    const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= tabs.length) return;

    const nextTabs = [...tabs];
    [nextTabs[currentIndex], nextTabs[nextIndex]] = [
      nextTabs[nextIndex],
      nextTabs[currentIndex],
    ];

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
          Puedes ordenar los tabs a tu gusto. El orden queda guardado en tu usuario.
        </p>
      </div>

      {loading ? (
        <div
          className="rounded-2xl p-6 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
          style={{ backgroundColor: adminTheme.surface }}
        >
          <p>Cargando tabs...</p>
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
          <div
            className="flex flex-wrap gap-2 rounded-2xl p-2 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
            style={{ backgroundColor: adminTheme.surface }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-1 rounded-xl p-1"
                style={
                  activeTab === tab.id
                    ? {
                        background: adminGradient(),
                        color: "#fff",
                        boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
                      }
                    : {
                        backgroundColor: adminTheme.surfaceAlt,
                        color: adminTheme.text,
                      }
                }
              >
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className="rounded-lg px-3 py-2 text-sm font-medium transition"
                  style={{ color: "inherit" }}
                >
                  {tab.label}
                </button>
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => moveTab(tab.id, "left")}
                    disabled={savingOrder || tabs[0]?.id === tab.id}
                    className="rounded-md px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor:
                        activeTab === tab.id ? "rgba(255,255,255,0.14)" : "#fff",
                      color: activeTab === tab.id ? "#fff" : adminTheme.text,
                    }}
                    aria-label={`Mover ${tab.label} a la izquierda`}
                    title="Mover a la izquierda"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTab(tab.id, "right")}
                    disabled={savingOrder || tabs[tabs.length - 1]?.id === tab.id}
                    className="rounded-md px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor:
                        activeTab === tab.id ? "rgba(255,255,255,0.14)" : "#fff",
                      color: activeTab === tab.id ? "#fff" : adminTheme.text,
                    }}
                    aria-label={`Mover ${tab.label} a la derecha`}
                    title="Mover a la derecha"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {renderContent()}
        </>
      )}
    </div>
  );
}

export default Admin;

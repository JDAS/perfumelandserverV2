import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardsViewer from "../components/admin/DashboardsViewer";
import ObjectListView from "../components/ObjectListView";
import ReportsViewer from "../components/admin/ReportsViewer";
import SuiteSetupPanel from "../components/SuiteSetupPanel";
import { useObjectMetadata } from "../context/ObjectMetadataContext";

function Admin() {
  const { objects, loading, refreshObjects } = useObjectMetadata();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab");

  const tabs = useMemo(
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

  const renderContent = () => {
    if (!currentTab) {
      return (
        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-gray-500">No hay contenido disponible.</p>
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
      <div className="rounded-xl bg-white p-6 shadow">
        <p className="text-gray-500">No hay contenido disponible.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Accesos por objeto y visualizadores internos del sistema.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 shadow">
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
          <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {renderContent()}
        </>
      )}
    </div>
  );
}

export default Admin;

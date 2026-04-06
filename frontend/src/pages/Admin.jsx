import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ObjectListView from "../components/ObjectListView";
import SuiteSetupPanel from "../components/SuiteSetupPanel";
import { useObjectMetadata } from "../context/ObjectMetadataContext";

function Admin() {
  const { objects, loading, refreshObjects } = useObjectMetadata();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab");

  const tabs = useMemo(() => {
    return [
      ...objects
        .filter((obj) => obj.active !== false && obj.tabsEnabled !== false)
        .map((obj) => ({ id: obj.apiName, label: obj.name, type: "object", object: obj })),
      { id: "reportes", label: "Reportes", type: "system" },
      { id: "dashboards", label: "Dashboards", type: "system" },
    ];
  }, [objects]);

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
      return <div className="bg-white rounded-xl shadow p-6"><p className="text-gray-500">No hay contenido disponible.</p></div>;
    }

    if (currentTab.type === "object") {
      return <ObjectListView objectDef={currentTab.object} />;
    }

    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-3">{currentTab.label}</h2>
        <p className="text-gray-600">Esta sección se desarrollará después.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Accesos por objeto, vistas de lista y navegación persistente</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-6"><p>Cargando tabs...</p></div>
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
          <div className="bg-white rounded-xl shadow p-2 flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
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

import { useEffect, useMemo, useState } from "react";
import { getObjects } from "../services/customService";
import ObjectListView from "../components/ObjectListView";

function Admin() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    loadObjects();
  }, []);

  const loadObjects = async () => {
    try {
      setLoading(true);
      const data = await getObjects();
      setObjects(data || []);

      if (data?.length > 0) {
        setActiveTab(data[0].apiName);
      } else {
        setActiveTab("reportes");
      }
    } catch (error) {
      console.error(error);
      setObjects([]);
      setActiveTab("reportes");
    } finally {
      setLoading(false);
    }
  };

  const tabs = useMemo(() => {
    return [
      ...objects.map((obj) => ({
        id: obj.apiName,
        label: obj.name,
        type: "object",
        object: obj,
      })),
      { id: "reportes", label: "Reportes", type: "system" },
      { id: "dashboards", label: "Dashboards", type: "system" },
    ];
  }, [objects]);

  const currentTab = tabs.find((tab) => tab.id === activeTab);

  const renderContent = () => {
    if (!currentTab) {
      return (
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-500">No hay contenido disponible.</p>
        </div>
      );
    }

    if (currentTab.type === "object") {
      return <ObjectListView objectDef={currentTab.object} />;
    }

    if (currentTab.id === "reportes") {
      return (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-bold mb-3">Reportes</h2>
          <p className="text-gray-600">
            Esta sección se desarrollará después.
          </p>
        </div>
      );
    }

    if (currentTab.id === "dashboards") {
      return (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-bold mb-3">Dashboards</h2>
          <p className="text-gray-600">
            Aquí irán los dashboards administrativos.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Accesos por objeto y vistas del sistema
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-6">
          <p>Cargando tabs...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow p-2 flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
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
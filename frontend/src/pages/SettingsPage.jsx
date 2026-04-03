import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteObject } from "../services/customService";
import ObjectModal from "../components/ObjectModal";
import { useObjectMetadata } from "../context/ObjectMetadataContext";

function SettingsPage() {
  const [activeSection, setActiveSection] = useState("objects");
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState(null);
  const { objects, loading, refreshObjects } = useObjectMetadata();

  const handleDeleteObject = async (apiName) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el objeto "${apiName}"?`)) return;
    try {
      await deleteObject(apiName);
      await refreshObjects();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || "Error eliminando el objeto");
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-80 bg-white border-r p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">Administración general del sistema</p>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-3">Navegación</h2>
          <div className="space-y-2">
            <button className={`block w-full text-left px-3 py-2 rounded ${activeSection === "objects" ? "bg-black text-white" : "bg-gray-100"}`} onClick={() => setActiveSection("objects")}>Objetos</button>
            <button className={`block w-full text-left px-3 py-2 rounded ${activeSection === "profiles" ? "bg-black text-white" : "bg-gray-100"}`} onClick={() => setActiveSection("profiles")}>Perfiles</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeSection === "objects" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Objetos</h2>
                <p className="text-sm text-gray-500">Administra objetos, tabs y metadata</p>
              </div>
              <button onClick={() => { setEditingObject(null); setIsObjectModalOpen(true); }} className="bg-black text-white px-4 py-2 rounded">Nuevo objeto</button>
            </div>

            {loading ? <p>Cargando objetos...</p> : objects.length === 0 ? <p className="text-gray-500">No hay objetos creados.</p> : (
              <div className="space-y-3">
                {objects.map((obj) => (
                  <div key={obj.apiName} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{obj.name}</p>
                      <p className="text-sm text-gray-500">{obj.apiName}</p>
                      <p className="text-xs text-gray-400 mt-1">{obj.active === false ? "Inactivo" : "Activo"} · {obj.tabsEnabled === false ? "Sin tab" : "Con tab"}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button onClick={() => { setEditingObject(obj); setIsObjectModalOpen(true); }} className="px-3 py-1 bg-yellow-500 text-white rounded">Editar rápido</button>
                      <Link to={`/admin/object/${obj.apiName}`} className="px-3 py-1 bg-black text-white rounded">Editar metadata</Link>
                      <Link to={`/admin/${obj.apiName}/new?tab=${obj.apiName}`} className="px-3 py-1 bg-blue-600 text-white rounded">Nuevo registro</Link>
                      <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={() => handleDeleteObject(obj.apiName)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "profiles" && <div className="bg-white rounded-xl shadow p-6"><h2 className="text-2xl font-bold mb-4">Perfiles</h2><p className="text-gray-500">Esta sección estará disponible más adelante.</p></div>}
      </main>

      <ObjectModal open={isObjectModalOpen} initialData={editingObject} onClose={() => { setIsObjectModalOpen(false); setEditingObject(null); }} onSaved={refreshObjects} />
    </div>
  );
}

export default SettingsPage;

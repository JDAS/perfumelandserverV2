import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getObjects,
  deleteObject,
} from "../services/customService";

function SettingsPage() {
  const [activeSection, setActiveSection] = useState("objects");
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadObjects();
  }, []);

  const loadObjects = async () => {
    try {
      const data = await getObjects();
      setObjects(data || []);
    } catch (error) {
      console.error(error);
      alert("Error cargando objetos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteObject = async (apiName) => {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el objeto "${apiName}"?`
    );

    if (!confirmed) return;

    try {
      await deleteObject(apiName);
      setObjects((prev) => prev.filter((obj) => obj.apiName !== apiName));
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.error || "Error eliminando el objeto"
      );
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-80 bg-white border-r p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">
            Administración general del sistema
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Navegación</h2>

          <div className="space-y-2">
            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "objects"
                  ? "bg-black text-white"
                  : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("objects")}
            >
              Objetos
            </button>

            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "profiles"
                  ? "bg-black text-white"
                  : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("profiles")}
            >
              Perfiles
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeSection === "objects" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Objetos</h2>
                <p className="text-sm text-gray-500">
                  Administra los objetos personalizados
                </p>
              </div>

              <Link
                to="/admin/builder"
                className="bg-black text-white px-4 py-2 rounded"
              >
                Nuevo objeto
              </Link>
            </div>

            {loading ? (
              <p>Cargando objetos...</p>
            ) : objects.length === 0 ? (
              <p className="text-gray-500">No hay objetos creados.</p>
            ) : (
              <div className="space-y-3">
                {objects.map((obj) => (
                  <div
                    key={obj.apiName}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{obj.name}</p>
                      <p className="text-sm text-gray-500">
                        {obj.apiName}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Creado:{" "}
                        {obj.createdAt
                          ? new Date(obj.createdAt).toLocaleString()
                          : "-"}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        to={`/admin/object/${obj.apiName}`}
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                      >
                        Editar
                      </Link>

                      <Link
                        to={`/admin/${obj.apiName}/new`}
                        className="px-3 py-1 bg-blue-600 text-white rounded"
                      >
                        Nuevo registro
                      </Link>

                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded"
                        onClick={() => handleDeleteObject(obj.apiName)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "profiles" && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Perfiles</h2>
            <p className="text-gray-500">
              Esta sección estará disponible más adelante.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default SettingsPage;
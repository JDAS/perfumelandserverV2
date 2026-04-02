import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getObjectByApiName,
  updateObject,
} from "../services/customService";

function ObjectMetadataPage() {
  const { apiName } = useParams();

  const [objectData, setObjectData] = useState(null);
  const [activeSection, setActiveSection] = useState("details");
  const [loading, setLoading] = useState(true);

  const [newField, setNewField] = useState({
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
  });

  const [newLayout, setNewLayout] = useState({
    label: "",
    apiName: "",
    sections: [],
  });

  useEffect(() => {
    loadObject();
  }, [apiName]);

  const loadObject = async () => {
    try {
      const data = await getObjectByApiName(apiName);
      setObjectData(data);
    } catch (error) {
      console.error(error);
      alert("Error cargando objeto");
    } finally {
      setLoading(false);
    }
  };

  const normalizeApiName = (value) =>
    value.toLowerCase().trim().replace(/\s+/g, "_");

  const addField = async () => {
    if (!newField.label.trim()) {
      alert("El label es obligatorio");
      return;
    }

    const fieldToAdd = {
      ...newField,
      apiName: newField.apiName?.trim()
        ? normalizeApiName(newField.apiName)
        : normalizeApiName(newField.label),
      options: newField.type === "select" ? newField.options : [],
    };

    const updated = {
      ...objectData,
      fields: [...(objectData.fields || []), fieldToAdd],
    };

    const saved = await updateObject(apiName, updated);
    setObjectData(saved);
    setNewField({
      label: "",
      apiName: "",
      type: "text",
      required: false,
      options: [],
    });
  };

  const deleteField = async (fieldApiName) => {
    const confirmed = window.confirm("¿Eliminar este campo?");
    if (!confirmed) return;

    const updated = {
      ...objectData,
      fields: objectData.fields.filter((f) => f.apiName !== fieldApiName),
      layout: (objectData.layout || []).map((layout) => ({
        ...layout,
        sections: (layout.sections || []).map((section) => ({
          ...section,
          fields: (section.fields || []).filter((f) => f !== fieldApiName),
        })),
      })),
    };

    const saved = await updateObject(apiName, updated);
    setObjectData(saved);
  };

  const addLayout = async () => {
    if (!newLayout.label.trim()) {
      alert("El nombre del layout es obligatorio");
      return;
    }

    const layoutToAdd = {
      label: newLayout.label,
      apiName: newLayout.apiName?.trim()
        ? normalizeApiName(newLayout.apiName)
        : normalizeApiName(newLayout.label),
      sections: [
        {
          label: "Detalles",
          columns: 2,
          fields: objectData.fields?.length
            ? objectData.fields.map((f) => f.apiName)
            : [],
        },
      ],
    };

    const updated = {
      ...objectData,
      layout: [...(objectData.layout || []), layoutToAdd],
    };

    const saved = await updateObject(apiName, updated);
    setObjectData(saved);
    setNewLayout({
      label: "",
      apiName: "",
      sections: [],
    });
  };

  const deleteLayout = async (layoutApiName) => {
    const confirmed = window.confirm("¿Eliminar este layout?");
    if (!confirmed) return;

    const updated = {
      ...objectData,
      layout: (objectData.layout || []).filter(
        (l) => l.apiName !== layoutApiName
      ),
    };

    const saved = await updateObject(apiName, updated);
    setObjectData(saved);
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  if (!objectData) {
    return <div className="p-6">Objeto no encontrado</div>;
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-80 bg-white border-r p-6 space-y-8">
        <div>
          <h2 className="text-lg font-bold mb-3">Detalles del objeto</h2>
          <div className="text-sm space-y-2">
            <p><span className="font-semibold">Nombre:</span> {objectData.name}</p>
            <p><span className="font-semibold">API Name:</span> {objectData.apiName}</p>
            <p>
              <span className="font-semibold">Creado:</span>{" "}
              {new Date(objectData.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Navegación</h2>
          <div className="space-y-2">
            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "details" ? "bg-black text-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("details")}
            >
              Detalles
            </button>

            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "fields" ? "bg-black text-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("fields")}
            >
              Campos
            </button>

            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "layouts" ? "bg-black text-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("layouts")}
            >
              Layouts
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeSection === "details" && (
          <div className="bg-white rounded-xl shadow p-6">
            <h1 className="text-2xl font-bold mb-4">Detalles</h1>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Nombre</label>
                <input
                  className="border p-2 w-full"
                  value={objectData.name}
                  onChange={(e) =>
                    setObjectData({ ...objectData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm mb-1">API Name</label>
                <input
                  className="border p-2 w-full"
                  value={objectData.apiName}
                  onChange={(e) =>
                    setObjectData({ ...objectData, apiName: e.target.value })
                  }
                />
              </div>

              <button
                className="bg-black text-white px-4 py-2 rounded"
                onClick={async () => {
                  const saved = await updateObject(apiName, objectData);
                  setObjectData(saved);
                  alert("Objeto actualizado");
                }}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        )}

        {activeSection === "fields" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h1 className="text-2xl font-bold mb-4">Campos</h1>

              <div className="space-y-3 mb-6">
                {objectData.fields?.map((field) => (
                  <div
                    key={field.apiName}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{field.label}</p>
                      <p className="text-sm text-gray-500">
                        {field.apiName} · {field.type}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                        onClick={() => {
                          const newLabel = prompt("Nuevo label", field.label);
                          if (!newLabel) return;

                          const updated = {
                            ...objectData,
                            fields: objectData.fields.map((f) =>
                              f.apiName === field.apiName
                                ? { ...f, label: newLabel }
                                : f
                            ),
                          };

                          updateObject(apiName, updated).then(setObjectData);
                        }}
                      >
                        Editar
                      </button>

                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded"
                        onClick={() => deleteField(field.apiName)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-lg font-bold mb-3">Nuevo campo</h2>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border p-2"
                  placeholder="Label"
                  value={newField.label}
                  onChange={(e) =>
                    setNewField({ ...newField, label: e.target.value })
                  }
                />

                <input
                  className="border p-2"
                  placeholder="API Name"
                  value={newField.apiName}
                  onChange={(e) =>
                    setNewField({ ...newField, apiName: e.target.value })
                  }
                />

                <select
                  className="border p-2"
                  value={newField.type}
                  onChange={(e) =>
                    setNewField({
                      ...newField,
                      type: e.target.value,
                      options: [],
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select</option>
                  <option value="date">Date</option>
                </select>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) =>
                      setNewField({ ...newField, required: e.target.checked })
                    }
                  />
                  Requerido
                </label>

                {newField.type === "select" && (
                  <input
                    className="border p-2 col-span-2"
                    placeholder="Opciones separadas por coma"
                    onChange={(e) =>
                      setNewField({
                        ...newField,
                        options: e.target.value
                          .split(",")
                          .map((opt) => opt.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                )}
              </div>

              <button
                className="mt-4 bg-black text-white px-4 py-2 rounded"
                onClick={addField}
              >
                Crear campo
              </button>
            </div>
          </div>
        )}

        {activeSection === "layouts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h1 className="text-2xl font-bold mb-4">Layouts</h1>

              <div className="space-y-3 mb-6">
                {objectData.layout?.map((layout) => (
                  <div
                    key={layout.apiName}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{layout.label}</p>
                      <p className="text-sm text-gray-500">{layout.apiName}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                        onClick={() => {
                          const newLabel = prompt("Nuevo label", layout.label);
                          if (!newLabel) return;

                          const updated = {
                            ...objectData,
                            layout: objectData.layout.map((l) =>
                              l.apiName === layout.apiName
                                ? { ...l, label: newLabel }
                                : l
                            ),
                          };

                          updateObject(apiName, updated).then(setObjectData);
                        }}
                      >
                        Editar
                      </button>

                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded"
                        onClick={() => deleteLayout(layout.apiName)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-lg font-bold mb-3">Nuevo layout</h2>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border p-2"
                  placeholder="Label"
                  value={newLayout.label}
                  onChange={(e) =>
                    setNewLayout({ ...newLayout, label: e.target.value })
                  }
                />

                <input
                  className="border p-2"
                  placeholder="API Name"
                  value={newLayout.apiName}
                  onChange={(e) =>
                    setNewLayout({ ...newLayout, apiName: e.target.value })
                  }
                />
              </div>

              <button
                className="mt-4 bg-black text-white px-4 py-2 rounded"
                onClick={addLayout}
              >
                Crear layout
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ObjectMetadataPage;
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getObjectByApiName,
  updateObject,
} from "../services/customService";
import LayoutEditor from "../components/LayoutEditor";
import FieldModal from "../components/FieldModal";
import ListViewsEditor from "../components/ListViewsEditor";

function ObjectMetadataPage() {
  const { apiName } = useParams();

  const [objectData, setObjectData] = useState(null);
  const [activeSection, setActiveSection] = useState("details");
  const [loading, setLoading] = useState(true);

  const [editingLayout, setEditingLayout] = useState(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);

  const [newLayout, setNewLayout] = useState({
    label: "",
    apiName: "",
  });

  useEffect(() => {
    loadObject();
  }, [apiName]);

  const loadObject = async () => {
    try {
      setLoading(true);
      const data = await getObjectByApiName(apiName);
      setObjectData({
        ...data,
        fields: data.fields || [],
        layout: data.layout || [],
        listViews: data.listViews || [],
      });
    } catch (error) {
      console.error(error);
      alert("Error cargando objeto");
    } finally {
      setLoading(false);
    }
  };

  const normalizeApiName = (value) =>
    value.toLowerCase().trim().replace(/\s+/g, "_");

  const deleteField = async (fieldApiName) => {
    const confirmed = window.confirm("¿Eliminar este campo?");
    if (!confirmed) return;

    const updated = {
      ...objectData,
      fields: (objectData.fields || []).filter(
        (f) => f.apiName !== fieldApiName
      ),
      layout: (objectData.layout || []).map((layout) => ({
        ...layout,
        sections: (layout.sections || []).map((section) => ({
          ...section,
          fields: (section.fields || []).filter(
            (item) => item !== fieldApiName
          ),
        })),
      })),
      listViews: (objectData.listViews || []).map((view) => ({
        ...view,
        columns: (view.columns || []).filter((col) => col !== fieldApiName),
        filters: (view.filters || []).filter((filter) => filter.field !== fieldApiName),
      })),
    };

    const saved = await updateObject(apiName, updated);
    setObjectData({
      ...saved,
      fields: saved.fields || [],
      layout: saved.layout || [],
      listViews: saved.listViews || [],
    });
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
          fields: [],
        },
      ],
    };

    const updated = {
      ...objectData,
      layout: [...(objectData.layout || []), layoutToAdd],
    };

    const saved = await updateObject(apiName, updated);
    setObjectData({
      ...saved,
      fields: saved.fields || [],
      layout: saved.layout || [],
      listViews: saved.listViews || [],
    });
    setNewLayout({
      label: "",
      apiName: "",
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
    setObjectData({
      ...saved,
      fields: saved.fields || [],
      layout: saved.layout || [],
      listViews: saved.listViews || [],
    });
  };

  const saveEditedLayout = async (updatedLayout) => {
    const updated = {
      ...objectData,
      layout: (objectData.layout || []).map((l) =>
        l.apiName === updatedLayout.apiName ? updatedLayout : l
      ),
    };

    const saved = await updateObject(apiName, updated);
    setObjectData({
      ...saved,
      fields: saved.fields || [],
      layout: saved.layout || [],
      listViews: saved.listViews || [],
    });
    setEditingLayout(null);
  };

  const openCreateFieldModal = () => {
    setEditingField(null);
    setIsFieldModalOpen(true);
  };

  const openEditFieldModal = (field) => {
    setEditingField(field);
    setIsFieldModalOpen(true);
  };

  const saveField = async (fieldData) => {
    const exists = (objectData.fields || []).some(
      (f) =>
        f.apiName === fieldData.apiName &&
        (!editingField || f.apiName !== editingField.apiName)
    );

    if (exists) {
      alert("Ya existe un campo con ese API Name");
      return;
    }

    let updatedFields = [];
    let updatedLayouts = objectData.layout || [];
    let updatedListViews = objectData.listViews || [];

    if (editingField) {
      const oldApiName = editingField.apiName;
      const newApiName = fieldData.apiName;

      updatedFields = (objectData.fields || []).map((f) =>
        f.apiName === oldApiName ? fieldData : f
      );

      if (oldApiName !== newApiName) {
        updatedLayouts = updatedLayouts.map((layout) => ({
          ...layout,
          sections: (layout.sections || []).map((section) => ({
            ...section,
            fields: (section.fields || []).map((item) =>
              item === oldApiName ? newApiName : item
            ),
          })),
        }));

        updatedListViews = updatedListViews.map((view) => ({
          ...view,
          columns: (view.columns || []).map((col) =>
            col === oldApiName ? newApiName : col
          ),
          filters: (view.filters || []).map((filter) => ({
            ...filter,
            field: filter.field === oldApiName ? newApiName : filter.field,
          })),
        }));
      }
    } else {
      updatedFields = [...(objectData.fields || []), fieldData];
    }

    const saved = await updateObject(apiName, {
      ...objectData,
      fields: updatedFields,
      layout: updatedLayouts,
      listViews: updatedListViews,
    });

    setObjectData({
      ...saved,
      fields: saved.fields || [],
      layout: saved.layout || [],
      listViews: saved.listViews || [],
    });
    setEditingField(null);
    setIsFieldModalOpen(false);
  };

  const saveListViews = async (nextViews) => {
    const normalizedViews = (nextViews || []).map((view, index) => ({
      ...view,
      name: view.name || "",
      apiName: view.apiName?.trim()
        ? normalizeApiName(view.apiName)
        : normalizeApiName(view.name || `view_${index + 1}`),
      columns: view.columns || [],
      filters: view.filters || [],
      isDefault: !!view.isDefault,
    }));

    const defaultCount = normalizedViews.filter((view) => view.isDefault).length;

    if (normalizedViews.length > 0 && defaultCount === 0) {
      normalizedViews[0].isDefault = true;
    }

    if (defaultCount > 1) {
      let foundDefault = false;
      normalizedViews.forEach((view) => {
        if (view.isDefault && !foundDefault) {
          foundDefault = true;
        } else {
          view.isDefault = false;
        }
      });
    }

    const duplicatedApiNames = normalizedViews
      .map((view) => view.apiName)
      .filter((api, index, arr) => api && arr.indexOf(api) !== index);

    if (duplicatedApiNames.length > 0) {
      alert("Hay vistas con API Name repetido");
      return;
    }

    const saved = await updateObject(apiName, {
      ...objectData,
      listViews: normalizedViews,
    });

    setObjectData({
      ...saved,
      fields: saved.fields || [],
      layout: saved.layout || [],
      listViews: saved.listViews || [],
    });
    alert("Views actualizadas");
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
          <Link
            to="/admin/settings"
            className="text-sm text-gray-500 hover:text-black"
          >
            ← Volver a configuración
          </Link>

          <h2 className="text-lg font-bold mt-4 mb-3">
            Detalles del objeto
          </h2>

          <div className="text-sm space-y-2">
            <p>
              <span className="font-semibold">Nombre:</span>{" "}
              {objectData.name}
            </p>
            <p>
              <span className="font-semibold">API Name:</span>{" "}
              {objectData.apiName}
            </p>
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
                activeSection === "details"
                  ? "bg-black text-white"
                  : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("details")}
            >
              Detalles
            </button>

            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "fields"
                  ? "bg-black text-white"
                  : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("fields")}
            >
              Campos
            </button>

            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "layouts"
                  ? "bg-black text-white"
                  : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("layouts")}
            >
              Layouts
            </button>

            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "views"
                  ? "bg-black text-white"
                  : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("views")}
            >
              Views
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeSection === "details" && (
          <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">Detalles</h1>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 font-medium">
                  Nombre
                </label>
                <input
                  className="border p-2 w-full rounded"
                  value={objectData.name}
                  onChange={(e) =>
                    setObjectData({
                      ...objectData,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm mb-1 font-medium">
                  API Name
                </label>
                <input
                  className="border p-2 w-full rounded bg-gray-100"
                  value={objectData.apiName}
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  El API Name no se puede editar desde aquí.
                </p>
              </div>

              <div>
                <label className="block text-sm mb-1 font-medium">
                  Fecha de creación
                </label>
                <input
                  className="border p-2 w-full rounded bg-gray-100"
                  value={new Date(objectData.createdAt).toLocaleString()}
                  disabled
                />
              </div>

              <button
                className="bg-black text-white px-4 py-2 rounded"
                onClick={async () => {
                  const saved = await updateObject(apiName, {
                    ...objectData,
                    apiName: objectData.apiName,
                  });
                  setObjectData({
                    ...saved,
                    fields: saved.fields || [],
                    layout: saved.layout || [],
                    listViews: saved.listViews || [],
                  });
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
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Campos</h1>

                <button
                  className="bg-black text-white px-4 py-2 rounded"
                  onClick={openCreateFieldModal}
                >
                  Nuevo campo
                </button>
              </div>

              <div className="space-y-3">
                {objectData.fields?.map((field) => (
                  <div
                    key={field.apiName}
                    className="border rounded-lg p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold">{field.label}</p>
                      <p className="text-sm text-gray-500">
                        {field.apiName} · {field.type}
                        {field.required ? " · requerido" : ""}
                      </p>

                      {field.type === "select" &&
                        field.options?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Opciones: {field.options.join(", ")}
                          </p>
                        )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                        onClick={() => openEditFieldModal(field)}
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

                {(!objectData.fields || objectData.fields.length === 0) && (
                  <p className="text-sm text-gray-500">
                    No hay campos definidos.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === "layouts" && (
          <div className="space-y-6">
            {editingLayout && (
              <LayoutEditor
                layout={editingLayout}
                allFields={objectData.fields || []}
                onSave={saveEditedLayout}
                onCancel={() => setEditingLayout(null)}
              />
            )}

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
                      <p className="text-sm text-gray-500">
                        {layout.apiName}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                        onClick={() => setEditingLayout(layout)}
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

                {(!objectData.layout || objectData.layout.length === 0) && (
                  <p className="text-sm text-gray-500">
                    No hay layouts definidos.
                  </p>
                )}
              </div>

              <h2 className="text-lg font-bold mb-3">Nuevo layout</h2>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border p-2 rounded"
                  placeholder="Label"
                  value={newLayout.label}
                  onChange={(e) =>
                    setNewLayout({
                      ...newLayout,
                      label: e.target.value,
                    })
                  }
                />

                <input
                  className="border p-2 rounded"
                  placeholder="API Name"
                  value={newLayout.apiName}
                  onChange={(e) =>
                    setNewLayout({
                      ...newLayout,
                      apiName: e.target.value,
                    })
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

        {activeSection === "views" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Views</h1>

                <button
                  className="bg-black text-white px-4 py-2 rounded"
                  onClick={() => saveListViews(objectData.listViews || [])}
                >
                  Guardar views
                </button>
              </div>

              <ListViewsEditor
                objectDef={objectData}
                value={objectData.listViews || []}
                onChange={(nextViews) =>
                  setObjectData((prev) => ({
                    ...prev,
                    listViews: nextViews,
                  }))
                }
              />
            </div>
          </div>
        )}

        <FieldModal
          open={isFieldModalOpen}
          initialData={editingField}
          onClose={() => {
            setIsFieldModalOpen(false);
            setEditingField(null);
          }}
          onSave={saveField}
        />
      </main>
    </div>
  );
}

export default ObjectMetadataPage;
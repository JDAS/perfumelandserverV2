import { useEffect, useState } from "react";

function ObjectForm({ initialData = null, onSave, saving = false }) {
  const [name, setName] = useState("");
  const [apiName, setApiName] = useState("");
  const [fields, setFields] = useState([]);
  const [editingFieldApiName, setEditingFieldApiName] = useState(null);

  const emptyField = {
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
  };

  const [field, setField] = useState(emptyField);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setApiName(initialData.apiName || "");
      setFields(initialData.fields || []);
    } else {
      setName("");
      setApiName("");
      setFields([]);
    }

    setField(emptyField);
    setEditingFieldApiName(null);
  }, [initialData]);

  const normalizeApiName = (value) =>
    value.toLowerCase().trim().replace(/\s+/g, "_");

  const resetFieldForm = () => {
    setField(emptyField);
    setEditingFieldApiName(null);
  };

  const addOrUpdateField = () => {
    if (!field.label.trim()) {
      alert("El label del campo es obligatorio");
      return;
    }

    const finalApiName = field.apiName?.trim()
      ? normalizeApiName(field.apiName)
      : normalizeApiName(field.label);

    const exists = fields.some(
      (f) =>
        f.apiName === finalApiName &&
        f.apiName !== editingFieldApiName
    );

    if (exists) {
      alert("Ya existe un campo con ese API Name");
      return;
    }

    const newField = {
      label: field.label.trim(),
      apiName: finalApiName,
      type: field.type,
      required: field.required,
      options: field.type === "select" ? field.options || [] : [],
    };

    if (editingFieldApiName) {
      setFields((prev) =>
        prev.map((f) =>
          f.apiName === editingFieldApiName ? newField : f
        )
      );
    } else {
      setFields((prev) => [...prev, newField]);
    }

    resetFieldForm();
  };

  const editField = (fieldToEdit) => {
    setField({
      label: fieldToEdit.label || "",
      apiName: fieldToEdit.apiName || "",
      type: fieldToEdit.type || "text",
      required: !!fieldToEdit.required,
      options: fieldToEdit.options || [],
    });
    setEditingFieldApiName(fieldToEdit.apiName);
  };

  const removeField = (fieldApiName) => {
    setFields((prev) => prev.filter((f) => f.apiName !== fieldApiName));

    if (editingFieldApiName === fieldApiName) {
      resetFieldForm();
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("El nombre del objeto es obligatorio");
      return;
    }

    const finalApiName = apiName.trim()
      ? normalizeApiName(apiName)
      : normalizeApiName(name);

    const payload = {
      name: name.trim(),
      apiName: finalApiName,
      fields,
      layout: initialData?.layout?.length
        ? initialData.layout
        : [
            {
              label: "principal",
              apiName: "principal",
              sections: [
                {
                  label: "Detalles",
                  columns: 2,
                  fields:
                    fields.length > 0
                      ? fields.map((f) => f.apiName)
                      : ["name"],
                },
              ],
            },
          ],
    };

    onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block mb-1 text-sm font-medium">Nombre</label>
        <input
          placeholder="Nombre"
          className="border p-2 w-full rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium">API Name</label>
        <input
          placeholder="API Name (ej: product)"
          className="border p-2 w-full rounded"
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
        />
      </div>

      <div>
        <h2 className="font-bold mb-3">
          {editingFieldApiName ? "Editar campo" : "Campos"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            placeholder="Label"
            className="border p-2 rounded"
            value={field.label}
            onChange={(e) =>
              setField({ ...field, label: e.target.value })
            }
          />

          <input
            placeholder="API Name"
            className="border p-2 rounded"
            value={field.apiName}
            onChange={(e) =>
              setField({ ...field, apiName: e.target.value })
            }
          />

          <select
            className="border p-2 rounded"
            value={field.type}
            onChange={(e) =>
              setField({ ...field, type: e.target.value, options: [] })
            }
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="date">Date</option>
          </select>

          <label className="flex items-center gap-2 border p-2 rounded">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) =>
                setField({ ...field, required: e.target.checked })
              }
            />
            Required
          </label>

          {field.type === "select" && (
            <input
              placeholder="Opciones separadas por coma"
              className="border p-2 rounded md:col-span-2"
              value={field.options.join(", ")}
              onChange={(e) =>
                setField({
                  ...field,
                  options: e.target.value
                    .split(",")
                    .map((opt) => opt.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={addOrUpdateField}
            className="bg-gray-200 px-4 py-2 rounded"
            type="button"
          >
            {editingFieldApiName ? "Actualizar campo" : "Agregar campo"}
          </button>

          {editingFieldApiName && (
            <button
              onClick={resetFieldForm}
              className="bg-gray-100 px-4 py-2 rounded"
              type="button"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <div className="space-y-2">
          {fields.map((f, i) => (
            <div
              key={`${f.apiName}-${i}`}
              className="border rounded-lg p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">
                  {f.label} - {f.apiName}
                </div>
                <div className="text-sm text-gray-500">
                  {f.type} {f.required ? "· requerido" : ""}
                </div>
                {f.type === "select" && f.options?.length > 0 && (
                  <div className="text-xs text-gray-400">
                    {f.options.join(", ")}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => editField(f)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                  type="button"
                >
                  Editar
                </button>

                <button
                  onClick={() => removeField(f.apiName)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                  type="button"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-sm text-gray-500">
              Aún no hay campos definidos.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="bg-black text-white w-full py-2 rounded"
        type="button"
        disabled={saving}
      >
        {saving ? "Guardando..." : "Guardar objeto"}
      </button>
    </div>
  );
}

export default ObjectForm;
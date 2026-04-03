import { useEffect, useState } from "react";
import { normalizeApiName } from "../engine/metadataEngine";

function ObjectForm({ initialData = null, onSave, saving = false }) {
  const emptyField = {
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  };

  const [name, setName] = useState("");
  const [pluralLabel, setPluralLabel] = useState("");
  const [description, setDescription] = useState("");
  const [apiName, setApiName] = useState("");
  const [active, setActive] = useState(true);
  const [tabsEnabled, setTabsEnabled] = useState(true);
  const [fields, setFields] = useState([]);
  const [editingFieldApiName, setEditingFieldApiName] = useState(null);
  const [field, setField] = useState(emptyField);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setPluralLabel(initialData.pluralLabel || initialData.name || "");
      setDescription(initialData.description || "");
      setApiName(initialData.apiName || "");
      setActive(initialData.active !== false);
      setTabsEnabled(initialData.tabsEnabled !== false);
      setFields(initialData.fields || []);
    } else {
      setName("");
      setPluralLabel("");
      setDescription("");
      setApiName("");
      setActive(true);
      setTabsEnabled(true);
      setFields([]);
    }
    setField(emptyField);
    setEditingFieldApiName(null);
  }, [initialData]);

  const resetFieldForm = () => {
    setField(emptyField);
    setEditingFieldApiName(null);
  };

  const addOrUpdateField = () => {
    if (!field.label.trim()) {
      alert("El label del campo es obligatorio");
      return;
    }

    const finalApiName = field.apiName?.trim() ? normalizeApiName(field.apiName) : normalizeApiName(field.label);
    const exists = fields.some((existingField) => existingField.apiName === finalApiName && existingField.apiName !== editingFieldApiName);
    if (exists) {
      alert("Ya existe un campo con ese API Name");
      return;
    }

    const newField = {
      ...field,
      label: field.label.trim(),
      apiName: finalApiName,
      options: field.type === "select" ? field.options || [] : [],
    };

    if (editingFieldApiName) {
      setFields((prev) => prev.map((currentField) => currentField.apiName === editingFieldApiName ? newField : currentField));
    } else {
      setFields((prev) => [...prev, newField]);
    }

    resetFieldForm();
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("El nombre del objeto es obligatorio");
      return;
    }

    if (fields.length === 0) {
      alert("Debes agregar al menos un campo");
      return;
    }

    const finalApiName = apiName.trim() ? normalizeApiName(apiName) : normalizeApiName(name);
    const payload = {
      name: name.trim(),
      pluralLabel: pluralLabel.trim() || name.trim(),
      description: description.trim(),
      apiName: finalApiName,
      active,
      tabsEnabled,
      fields,
      layout: initialData?.layout?.length
        ? initialData.layout
        : [{ label: "principal", apiName: "principal", sections: [{ label: "Detalles", columns: 2, fields: fields.map((currentField) => currentField.apiName) }] }],
      listViews: initialData?.listViews?.length
        ? initialData.listViews
        : [{ label: "Todos", apiName: "all", isDefault: true, columns: fields.slice(0, 5).map((currentField) => currentField.apiName), filters: [], sortBy: "createdAt", sortOrder: "desc" }],
    };

    onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Nombre</label>
          <input className="border p-2 w-full rounded" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Plural Label</label>
          <input className="border p-2 w-full rounded" value={pluralLabel} onChange={(e) => setPluralLabel(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">API Name</label>
          <input className="border p-2 w-full rounded" value={apiName} onChange={(e) => setApiName(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Descripción</label>
          <input className="border p-2 w-full rounded" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-6 flex-wrap text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={tabsEnabled} onChange={(e) => setTabsEnabled(e.target.checked)} /> Mostrar tab</label>
      </div>

      <div>
        <h2 className="font-bold mb-3">{editingFieldApiName ? "Editar campo" : "Campos"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input placeholder="Label" className="border p-2 rounded" value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} />
          <input placeholder="API Name" className="border p-2 rounded" value={field.apiName} onChange={(e) => setField({ ...field, apiName: e.target.value })} />
          <select className="border p-2 rounded" value={field.type} onChange={(e) => setField({ ...field, type: e.target.value, options: [] })}>
            <option value="text">Text</option>
            <option value="textarea">Textarea</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="date">Date</option>
            <option value="boolean">Boolean</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="url">URL</option>
          </select>
          <label className="flex items-center gap-2 border p-2 rounded"><input type="checkbox" checked={field.required} onChange={(e) => setField({ ...field, required: e.target.checked })} /> Required</label>
          {field.type === "select" && <input placeholder="Opciones separadas por coma" className="border p-2 rounded md:col-span-2" value={field.options.join(", ")} onChange={(e) => setField({ ...field, options: e.target.value.split(",").map((opt) => opt.trim()).filter(Boolean) })} />}
        </div>
        <div className="flex gap-4 flex-wrap text-sm mb-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={field.visibleInList} onChange={(e) => setField({ ...field, visibleInList: e.target.checked })} /> Visible en lista</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={field.visibleInForm} onChange={(e) => setField({ ...field, visibleInForm: e.target.checked })} /> Visible en formulario</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={field.visibleInDetail} onChange={(e) => setField({ ...field, visibleInDetail: e.target.checked })} /> Visible en detalle</label>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={addOrUpdateField} className="bg-gray-200 px-4 py-2 rounded" type="button">{editingFieldApiName ? "Actualizar campo" : "Agregar campo"}</button>
          {editingFieldApiName && <button onClick={resetFieldForm} className="bg-gray-100 px-4 py-2 rounded" type="button">Cancelar edición</button>}
        </div>

        <div className="space-y-2">
          {fields.map((currentField) => (
            <div key={currentField.apiName} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{currentField.label} - {currentField.apiName}</div>
                <div className="text-sm text-gray-500">{currentField.type} {currentField.required ? "· requerido" : ""}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="bg-yellow-500 text-white px-3 py-1 rounded" onClick={() => { setField(currentField); setEditingFieldApiName(currentField.apiName); }}>Editar</button>
                <button type="button" className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => setFields((prev) => prev.filter((item) => item.apiName !== currentField.apiName))}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button disabled={saving} onClick={handleSubmit} type="button" className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar objeto"}</button>
      </div>
    </div>
  );
}

export default ObjectForm;

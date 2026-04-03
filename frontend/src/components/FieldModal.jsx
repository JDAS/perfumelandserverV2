import { useEffect, useState } from "react";
import { normalizeApiName } from "../engine/metadataEngine";

function FieldModal({ open, onClose, onSave, initialData = null }) {
  const [field, setField] = useState({
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  });

  useEffect(() => {
    if (initialData) {
      setField({ ...field, ...initialData });
    } else {
      setField({ label: "", apiName: "", type: "text", required: false, options: [], visibleInList: true, visibleInDetail: true, visibleInForm: true });
    }
  }, [initialData, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!field.label.trim()) {
      alert("El label es obligatorio");
      return;
    }
    const finalField = {
      ...field,
      apiName: field.apiName?.trim() ? normalizeApiName(field.apiName) : normalizeApiName(field.label),
      options: field.type === "select" ? field.options : [],
    };
    onSave(finalField);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="border-b px-6 py-4"><h2 className="text-xl font-bold">{initialData ? "Editar campo" : "Nuevo campo"}</h2></div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div><label className="mb-1 block text-sm font-medium">Label</label><input className="w-full rounded border p-2" value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">API Name</label><input className="w-full rounded border p-2" value={field.apiName} onChange={(e) => setField({ ...field, apiName: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Tipo</label><select className="w-full rounded border p-2" value={field.type} onChange={(e) => setField({ ...field, type: e.target.value, options: e.target.value === "select" ? field.options : [] })}><option value="text">Text</option><option value="textarea">Textarea</option><option value="number">Number</option><option value="select">Select</option><option value="date">Date</option><option value="boolean">Boolean</option><option value="email">Email</option><option value="phone">Phone</option><option value="url">URL</option></select></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={field.required} onChange={(e) => setField({ ...field, required: e.target.checked })} /><span>Requerido</span></label>
          {field.type === "select" && <div><label className="mb-1 block text-sm font-medium">Opciones</label><input className="w-full rounded border p-2" value={field.options.join(", ")} onChange={(e) => setField({ ...field, options: e.target.value.split(",").map((opt) => opt.trim()).filter(Boolean) })} /></div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={field.visibleInList} onChange={(e) => setField({ ...field, visibleInList: e.target.checked })} /> Lista</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={field.visibleInForm} onChange={(e) => setField({ ...field, visibleInForm: e.target.checked })} /> Formulario</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={field.visibleInDetail} onChange={(e) => setField({ ...field, visibleInDetail: e.target.checked })} /> Detalle</label>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" className="rounded bg-gray-200 px-4 py-2" onClick={onClose}>Cancelar</button><button type="submit" className="rounded bg-black px-4 py-2 text-white">Guardar</button></div>
        </form>
      </div>
    </div>
  );
}

export default FieldModal;

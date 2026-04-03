import { useState } from "react";
import { createObject, updateObject } from "../services/customService";
import ObjectForm from "./ObjectForm";

function ObjectModal({ open, onClose, onSaved, initialData = null }) {
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (payload) => {
    try {
      setSaving(true);
      if (initialData?.apiName) {
        await updateObject(initialData.apiName, payload);
      } else {
        await createObject(payload);
      }
      await onSaved?.();
      onClose?.();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || "Error guardando el objeto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-bold">{initialData ? "Editar objeto" : "Nuevo objeto"}</h2>
        </div>
        <div className="px-6 py-5 max-h-[85vh] overflow-y-auto">
          <ObjectForm initialData={initialData} onSave={handleSave} saving={saving} />
        </div>
        <div className="border-t px-6 py-4 flex justify-end">
          <button type="button" className="rounded bg-gray-200 px-4 py-2" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default ObjectModal;

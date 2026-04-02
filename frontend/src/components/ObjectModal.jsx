import { useEffect, useState } from "react";
import axios from "axios";

function ObjectModal({ open, onClose, onSaved, initialData = null }) {
    const [name, setName] = useState("");
    const [apiName, setApiName] = useState("");
    const [fields, setFields] = useState([]);
    const [editingFieldApiName, setEditingFieldApiName] = useState(null);
    const [layouts, setLayouts] = useState([]);

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
            setLayouts(initialData.layout || []);
        } else {
            setName("");
            setApiName("");
            setFields([]);
            setLayouts([]);
        }

        setField(emptyField);
        setEditingFieldApiName(null);
    }, [initialData, open]);

    const normalizeApiName = (value) =>
        value.toLowerCase().trim().replace(/\s+/g, "_");

    const resetFieldForm = () => {
        setField(emptyField);
        setEditingFieldApiName(null);
    };

    const handleEditField = (fieldToEdit) => {
        setField({
            label: fieldToEdit.label || "",
            apiName: fieldToEdit.apiName || "",
            type: fieldToEdit.type || "text",
            required: !!fieldToEdit.required,
            options: fieldToEdit.options || [],
        });
        setEditingFieldApiName(fieldToEdit.apiName);
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

            if (
                initialData?.layout?.length &&
                editingFieldApiName !== finalApiName
            ) {
                initialData.layout = initialData.layout.map((layout) => ({
                    ...layout,
                    sections: (layout.sections || []).map((section) => ({
                        ...section,
                        fields: (section.fields || []).map((item) =>
                            item === editingFieldApiName ? finalApiName : item
                        ),
                    })),
                }));
            }
        } else {
            setFields((prev) => [...prev, newField]);
        }

        resetFieldForm();
    };

    const removeField = (fieldApiName) => {
        setFields((prev) => prev.filter((f) => f.apiName !== fieldApiName));

        if (editingFieldApiName === fieldApiName) {
            resetFieldForm();
        }
    };

    const saveObject = async () => {
        if (!name.trim()) {
            alert("El nombre del objeto es obligatorio");
            return;
        }

        const finalApiName = apiName.trim()
            ? normalizeApiName(apiName)
            : normalizeApiName(name);

        const existingLayout = initialData?.layout?.length
            ? initialData.layout
            : [
                {
                    label: "principal",
                    apiName: "principal",
                    sections: [
                        {
                            label: "Detalles",
                            columns: 2,
                            fields: fields.length > 0 ? fields.map((f) => f.apiName) : ["name"],
                        },
                    ],
                },
            ];

        // Si cambió el apiName de un campo, también actualizamos layouts existentes
        let normalizedLayout = existingLayout.map((layout) => ({
            ...layout,
            sections: (layout.sections || []).map((section) => ({
                ...section,
                fields: (section.fields || []).filter((item) => {
                    if (typeof item !== "string") return false;
                    if (item.startsWith("__blank__")) return true;
                    return fields.some((f) => f.apiName === item);
                }),
            })),
        }));

        const payload = {
            name: name.trim(),
            apiName: finalApiName,
            fields,
            layout: normalizedLayout,
        };

        try {
            if (initialData?.apiName) {
                await axios.put(`/api/custom-objects/${initialData.apiName}`, payload);
            } else {
                await axios.post("/api/custom-objects", payload);
            }

            onSaved?.();
            onClose?.();
        } catch (error) {
            console.error(error);
            alert(error?.response?.data?.error || "Error guardando el objeto");
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
                <div className="border-b px-6 py-4">
                    <h2 className="text-xl font-bold">
                        {initialData ? "Editar objeto" : "Nuevo objeto"}
                    </h2>
                </div>

                <div className="space-y-6 px-6 py-5 max-h-[85vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium">Nombre</label>
                            <input
                                className="w-full rounded border p-2"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium">API Name</label>
                            <input
                                className="w-full rounded border p-2"
                                value={apiName}
                                onChange={(e) => setApiName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-3">
                            {editingFieldApiName ? "Editar campo" : "Nuevo campo"}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <input
                                className="border p-2 rounded"
                                placeholder="Label"
                                value={field.label}
                                onChange={(e) =>
                                    setField({ ...field, label: e.target.value })
                                }
                            />

                            <input
                                className="border p-2 rounded"
                                placeholder="API Name"
                                value={field.apiName}
                                onChange={(e) =>
                                    setField({ ...field, apiName: e.target.value })
                                }
                            />

                            <select
                                className="border p-2 rounded"
                                value={field.type}
                                onChange={(e) =>
                                    setField({
                                        ...field,
                                        type: e.target.value,
                                        options: e.target.value === "select" ? field.options : [],
                                    })
                                }
                            >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="select">Select</option>
                                <option value="date">Date</option>
                            </select>

                            <label className="flex items-center gap-2 border rounded p-2">
                                <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={(e) =>
                                        setField({ ...field, required: e.target.checked })
                                    }
                                />
                                Requerido
                            </label>

                            {field.type === "select" && (
                                <input
                                    className="border p-2 rounded md:col-span-2"
                                    placeholder="Opciones separadas por coma"
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
                                type="button"
                                onClick={addOrUpdateField}
                                className="bg-gray-200 px-4 py-2 rounded"
                            >
                                {editingFieldApiName ? "Actualizar campo" : "Agregar campo"}
                            </button>

                            {editingFieldApiName && (
                                <button
                                    type="button"
                                    onClick={resetFieldForm}
                                    className="bg-gray-100 px-4 py-2 rounded"
                                >
                                    Cancelar edición
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {fields.map((f) => (
                                <div
                                    key={f.apiName}
                                    className="border rounded-lg p-3 flex items-center justify-between gap-3"
                                >
                                    <div>
                                        <p className="font-medium">{f.label}</p>
                                        <p className="text-sm text-gray-500">
                                            {f.apiName} · {f.type}
                                            {f.required ? " · requerido" : ""}
                                        </p>
                                        {f.type === "select" && f.options?.length > 0 && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                Opciones: {f.options.join(", ")}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEditField(f)}
                                            className="bg-yellow-500 text-white px-3 py-1 rounded"
                                        >
                                            Editar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => removeField(f.apiName)}
                                            className="bg-red-600 text-white px-3 py-1 rounded"
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
                </div>

                <div className="border-t px-6 py-4 flex justify-end gap-3">
                    <button
                        type="button"
                        className="rounded bg-gray-200 px-4 py-2"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        className="rounded bg-black px-4 py-2 text-white"
                        onClick={saveObject}
                    >
                        Guardar objeto
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ObjectModal;
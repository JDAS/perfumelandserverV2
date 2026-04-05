import { useEffect, useState } from "react";
import ConditionBuilder from "./ConditionBuilder";
const EVENT_OPTIONS = [
    "beforeInsert",
    "afterInsert",
    "beforeUpdate",
    "afterUpdate",
    "beforeDelete",
    "afterDelete",
];

const CONDITION_OPERATORS = [
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "changed",
    "isEmpty",
    "isNotEmpty",
];

const ACTION_TYPES = ["updateField", "copyFromLookup", "createRecord", "log", "generatePayments"];

const emptyTrigger = {
    name: "",
    isActive: true,
    when: "beforeInsert",
    runOrder: 0,
    stopOnError: true,
    conditions: {
        operator: "AND",
        conditions: [
            {
                field: "",
                operator: "eq",
                value: "",
            },
        ],
    },
    actions: [],
};

function TriggerModal({
    show,
    onClose,
    onSave,
    trigger,
    fields = [],
    objectOptions = [],
}) {
    const [form, setForm] = useState(emptyTrigger);

    useEffect(() => {
        if (trigger) {
            setForm({
                ...emptyTrigger,
                ...trigger,
                conditions: trigger.conditions || {
                    operator: "AND",
                    conditions: [{ field: "", operator: "eq", value: "" }],
                },
                actions: Array.isArray(trigger.actions) ? trigger.actions : [],
            });
        } else {
            setForm(emptyTrigger);
        }
    }, [trigger, show]);

    if (!show) return null;

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const addCondition = () => {
        setForm((prev) => ({
            ...prev,
            conditions: [
                ...prev.conditions,
                { field: "", operator: "eq", value: "" },
            ],
        }));
    };

    const updateCondition = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            conditions: prev.conditions.map((item, i) =>
                i === index ? { ...item, [key]: value } : item
            ),
        }));
    };

    const removeCondition = (index) => {
        setForm((prev) => ({
            ...prev,
            conditions: prev.conditions.filter((_, i) => i !== index),
        }));
    };

    const addAction = () => {
        setForm((prev) => ({
            ...prev,
            actions: [
                ...prev.actions,
                {
                    type: "updateField",
                    config: {},
                },
            ],
        }));
    };

    const updateAction = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            actions: prev.actions.map((item, i) =>
                i === index ? { ...item, [key]: value } : item
            ),
        }));
    };

    const updateActionConfig = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            actions: prev.actions.map((item, i) =>
                i === index
                    ? {
                        ...item,
                        config: {
                            ...(item.config || {}),
                            [key]: value,
                        },
                    }
                    : item
            ),
        }));
    };

    const removeAction = (index) => {
        setForm((prev) => ({
            ...prev,
            actions: prev.actions.filter((_, i) => i !== index),
        }));
    };

    const handleSave = () => {
        if (!form.name.trim()) return;
        onSave({
            ...form,
            runOrder: Number(form.runOrder) || 0,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold">
                        {trigger ? "Editar Trigger" : "Nuevo Trigger"}
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border px-3 py-1"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium">Nombre</label>
                        <input
                            className="w-full rounded border p-2"
                            value={form.name}
                            onChange={(e) => updateField("name", e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Evento</label>
                        <select
                            className="w-full rounded border p-2"
                            value={form.when}
                            onChange={(e) => updateField("when", e.target.value)}
                        >
                            {EVENT_OPTIONS.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Orden</label>
                        <input
                            type="number"
                            className="w-full rounded border p-2"
                            value={form.runOrder}
                            onChange={(e) => updateField("runOrder", e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-6 pt-6">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => updateField("isActive", e.target.checked)}
                            />
                            Activo
                        </label>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.stopOnError}
                                onChange={(e) => updateField("stopOnError", e.target.checked)}
                            />
                            Detener en error
                        </label>
                    </div>
                </div>

                <div className="mt-8">
                    <div className="mb-3">
                        <h4 className="text-lg font-semibold">Condiciones</h4>
                        <p className="text-sm text-gray-500">
                            Puedes combinar condiciones con AND / OR y crear grupos anidados.
                        </p>
                    </div>

                    <ConditionBuilder
                        value={form.conditions}
                        onChange={(nextConditions) =>
                            setForm((prev) => ({
                                ...prev,
                                conditions: nextConditions,
                            }))
                        }
                        fields={fields}
                    />
                </div>

                <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-lg font-semibold">Acciones</h4>
                        <button
                            type="button"
                            onClick={addAction}
                            className="rounded border px-3 py-2"
                        >
                            Agregar acción
                        </button>
                    </div>

                    <div className="space-y-4">
                        {form.actions.length === 0 && (
                            <div className="rounded border border-dashed p-3 text-sm text-gray-500">
                                Sin acciones.
                            </div>
                        )}

                        {form.actions.map((action, index) => (
                            <div key={index} className="rounded border p-4">
                                <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">Tipo</label>
                                        <select
                                            className="w-full rounded border p-2"
                                            value={action.type}
                                            onChange={(e) =>
                                                updateAction(index, "type", e.target.value)
                                            }
                                        >
                                            {ACTION_TYPES.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2 flex items-end justify-end">
                                        <button
                                            type="button"
                                            onClick={() => removeAction(index)}
                                            className="rounded border px-3 py-2 text-red-600"
                                        >
                                            Eliminar acción
                                        </button>
                                    </div>
                                </div>

                                {action.type === "updateField" && (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-medium">
                                                Campo destino
                                            </label>
                                            <select
                                                className="w-full rounded border p-2"
                                                value={action.config?.field || ""}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "field", e.target.value)
                                                }
                                            >
                                                <option value="">Seleccione...</option>
                                                {fields.map((field) => (
                                                    <option key={field.apiName} value={field.apiName}>
                                                        {field.label} ({field.apiName})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Valor</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.value ?? ""}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "value", e.target.value)
                                                }
                                                placeholder="Ej: Alta o {{nombre}}"
                                            />
                                        </div>
                                    </div>
                                )}

                                {action.type === "createRecord" && (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-medium">
                                                Objeto a crear
                                            </label>
                                            <select
                                                className="w-full rounded border p-2"
                                                value={action.config?.object || ""}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "object", e.target.value)
                                                }
                                            >
                                                <option value="">Seleccione...</option>
                                                {objectOptions.map((obj) => (
                                                    <option key={obj.apiName} value={obj.apiName}>
                                                        {obj.name} ({obj.apiName})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">
                                                Valores JSON
                                            </label>
                                            <textarea
                                                className="min-h-[120px] w-full rounded border p-2 font-mono text-sm"
                                                value={
                                                    typeof action.config?.values === "string"
                                                        ? action.config.values
                                                        : JSON.stringify(action.config?.values || {}, null, 2)
                                                }
                                                onChange={(e) =>
                                                    updateActionConfig(index, "values", e.target.value)
                                                }
                                                placeholder={`{\n  "mensaje": "Registro {{nombre}} creado"\n}`}
                                            />
                                        </div>
                                    </div>
                                )}

                                {action.type === "log" && (
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Mensaje
                                        </label>
                                        <input
                                            className="w-full rounded border p-2"
                                            value={action.config?.message || ""}
                                            onChange={(e) =>
                                                updateActionConfig(index, "message", e.target.value)
                                            }
                                            placeholder="Ej: Se ejecutó el trigger para {{nombre}}"
                                        />
                                    </div>
                                )}
                                {action.type === "copyFromLookup" && (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-medium">
                                                Ruta origen
                                            </label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.sourcePath || ""}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "sourcePath", e.target.value)
                                                }
                                                placeholder="Ej: product.supplier.wholesalePrice"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">
                                                Campo destino
                                            </label>
                                            <select
                                                className="w-full rounded border p-2"
                                                value={action.config?.targetField || ""}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "targetField", e.target.value)
                                                }
                                            >
                                                <option value="">Seleccione...</option>
                                                {fields.map((field) => (
                                                    <option key={field.apiName} value={field.apiName}>
                                                        {field.label} ({field.apiName})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {action.type === "generatePayments" && (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Campo productos</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.productsField || "products"}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "productsField", e.target.value)
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Campo tipo</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.typeField || "type"}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "typeField", e.target.value)
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Campo tipo crédito</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.creditTypeField || "creditType"}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "creditTypeField", e.target.value)
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Campo cuotas</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.quotesField || "quotes"}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "quotesField", e.target.value)
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Campo fecha venta</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.salesDateField || "salesDate"}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "salesDateField", e.target.value)
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">Campo destino</label>
                                            <input
                                                className="w-full rounded border p-2"
                                                value={action.config?.targetField || "payments"}
                                                onChange={(e) =>
                                                    updateActionConfig(index, "targetField", e.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border px-4 py-2"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        className="rounded bg-black px-4 py-2 text-white"
                    >
                        Guardar Trigger
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TriggerModal;
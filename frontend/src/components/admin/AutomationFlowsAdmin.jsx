import { useCallback, useEffect, useMemo, useState } from "react";
import ConditionBuilder from "../ConditionBuilder";
import {
  createAutomationFlow,
  deleteAutomationFlow,
  getAutomationFlows,
  getObjectByApiName,
  updateAutomationFlow,
} from "../../services/customService";
import { useToast } from "../ui/ToastContext";

const EVENT_OPTIONS = [
  "beforeInsert",
  "afterInsert",
  "beforeUpdate",
  "afterUpdate",
  "beforeDelete",
  "afterDelete",
];

const ACTION_OPTIONS = [
  { value: "setField", label: "Actualizar campo" },
  { value: "setBoolean", label: "Asignar booleano" },
  { value: "setStatus", label: "Actualizar status" },
  { value: "createRecord", label: "Crear registro" },
];

const defaultForm = {
  name: "",
  apiName: "",
  description: "",
  objectApiName: "",
  isActive: true,
  when: "afterUpdate",
  runOrder: 0,
  stopOnError: true,
  conditions: {
    operator: "AND",
    conditions: [{ field: "", operator: "eq", value: "" }],
  },
  actions: [],
};

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function emptyAction(type = "setField") {
  switch (type) {
    case "setBoolean":
      return { type, config: { field: "", value: true } };
    case "setStatus":
      return { type, config: { field: "status", value: "" } };
    case "createRecord":
      return { type, config: { object: "", values: {} } };
    case "setField":
    default:
      return { type: "setField", config: { field: "", value: "" } };
  }
}

function normalizeForm(flow) {
  if (!flow) return defaultForm;

  return {
    ...defaultForm,
    ...flow,
    conditions: flow.conditions || defaultForm.conditions,
    actions: Array.isArray(flow.actions)
      ? flow.actions.map((action) => ({
          ...emptyAction(action.type),
          ...action,
          config: {
            ...(emptyAction(action.type).config || {}),
            ...(action.config || {}),
          },
        }))
      : [],
  };
}

function parseJsonSafely(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function stringifyActionValues(action) {
  if (action.type !== "createRecord") return action;

  return {
    ...action,
    config: {
      ...action.config,
      values:
        typeof action.config?.values === "string"
          ? action.config.values
          : JSON.stringify(action.config?.values || {}, null, 2),
    },
  };
}

export default function AutomationFlowsAdmin({ objects }) {
  const { addToast } = useToast();
  const [flows, setFlows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [sourceFields, setSourceFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableObjects = useMemo(
    () => (objects || []).filter((object) => object.active !== false),
    [objects]
  );

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAutomationFlows();
      setFlows(data || []);
    } catch (error) {
      console.error(error);
      addToast("No se pudieron cargar los flows", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  useEffect(() => {
    if (!form.objectApiName) {
      setSourceFields([]);
      return;
    }

    getObjectByApiName(form.objectApiName)
      .then((data) => setSourceFields(data.fields || []))
      .catch((error) => {
        console.error(error);
        setSourceFields([]);
      });
  }, [form.objectApiName]);

  const resetForm = () => {
    setSelectedId("");
    setForm(defaultForm);
  };

  const handleSelect = (flow) => {
    setSelectedId(flow._id);
    setForm(normalizeForm(flow));
  };

  const updateAction = (index, changes) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.map((action, actionIndex) =>
        actionIndex === index ? { ...action, ...changes } : action
      ),
    }));
  };

  const updateActionConfig = (index, changes) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.map((action, actionIndex) =>
        actionIndex === index
          ? {
              ...action,
              config: {
                ...(action.config || {}),
                ...changes,
              },
            }
          : action
      ),
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const payload = {
        ...form,
        apiName: slugify(form.apiName || form.name),
        runOrder: Number(form.runOrder || 0),
        actions: (form.actions || []).map((action) => {
          if (action.type !== "createRecord") {
            return action;
          }

          return {
            ...action,
            config: {
              ...action.config,
              values: parseJsonSafely(action.config?.values),
            },
          };
        }),
      };

      const saved = selectedId
        ? await updateAutomationFlow(selectedId, payload)
        : await createAutomationFlow(payload);

      await loadFlows();
      handleSelect(saved);
      addToast("Flow guardado", "success");
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo guardar el flow", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm("¿Eliminar este flow?")) return;

    try {
      await deleteAutomationFlow(selectedId);
      await loadFlows();
      resetForm();
      addToast("Flow eliminado", "success");
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo eliminar el flow", "error");
    }
  };

  const addAction = () => {
    setForm((current) => ({
      ...current,
      actions: [...(current.actions || []), emptyAction()],
    }));
  };

  const objectFieldOptions = sourceFields.map((field) => (
    <option key={field.apiName} value={field.apiName}>
      {field.label} ({field.apiName})
    </option>
  ));

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-xl bg-white p-4 shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Flows</h2>
            <p className="text-sm text-gray-500">
              Automatizaciones estructuradas sobre el motor actual.
            </p>
          </div>
          <button onClick={resetForm} className="rounded-lg bg-black px-3 py-2 text-sm text-white">
            Nuevo
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-gray-500">Cargando flows...</p> : null}
          {!loading && flows.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay flows creados.</p>
          ) : null}
          {flows.map((flow) => (
            <button
              key={flow._id}
              onClick={() => handleSelect(flow)}
              className={`w-full rounded-xl border p-3 text-left ${
                selectedId === flow._id ? "border-black bg-gray-50" : "border-gray-200"
              }`}
            >
              <p className="font-semibold text-gray-900">{flow.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                {flow.objectApiName} · {flow.when}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Nombre</span>
              <input
                className="w-full rounded-lg border p-3"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">API Name</span>
              <input
                className="w-full rounded-lg border p-3"
                value={form.apiName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, apiName: event.target.value }))
                }
                placeholder="sales_followup_completed"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <label className="space-y-2">
              <span className="text-sm font-medium">Descripción</span>
              <textarea
                className="min-h-24 w-full rounded-lg border p-3"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Objeto</span>
              <select
                className="w-full rounded-lg border p-3"
                value={form.objectApiName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    objectApiName: event.target.value,
                    actions: current.actions,
                  }))
                }
              >
                <option value="">Selecciona un objeto</option>
                {availableObjects.map((object) => (
                  <option key={object.apiName} value={object.apiName}>
                    {object.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Evento</span>
              <select
                className="w-full rounded-lg border p-3"
                value={form.when}
                onChange={(event) =>
                  setForm((current) => ({ ...current, when: event.target.value }))
                }
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_220px_1fr]">
            <label className="space-y-2">
              <span className="text-sm font-medium">Orden</span>
              <input
                type="number"
                className="w-full rounded-lg border p-3"
                value={form.runOrder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, runOrder: event.target.value }))
                }
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-4">
              <input
                type="checkbox"
                checked={Boolean(form.isActive)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              <div>
                <p className="font-medium">Flow activo</p>
                <p className="text-sm text-gray-500">Disponible para ejecución.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-4">
              <input
                type="checkbox"
                checked={Boolean(form.stopOnError)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stopOnError: event.target.checked }))
                }
              />
              <div>
                <p className="font-medium">Detener en error</p>
                <p className="text-sm text-gray-500">Evita continuar si una acción falla.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-3">
            <h3 className="text-lg font-bold">Condiciones</h3>
            <p className="text-sm text-gray-500">
              Combina reglas AND/OR usando los campos del objeto seleccionado.
            </p>
          </div>
          <ConditionBuilder
            value={form.conditions}
            onChange={(nextConditions) =>
              setForm((current) => ({ ...current, conditions: nextConditions }))
            }
            fields={sourceFields}
          />
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Acciones</h3>
              <p className="text-sm text-gray-500">
                Esta V1 soporta actualizar campos y crear registros relacionados.
              </p>
            </div>
            <button onClick={addAction} className="rounded-lg border px-3 py-2 text-sm">
              Agregar acción
            </button>
          </div>

          <div className="space-y-4">
            {(form.actions || []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
                Aún no hay acciones en este flow.
              </div>
            ) : null}

            {(form.actions || []).map((action, index) => {
              const hydratedAction = stringifyActionValues(action);
              return (
                <div key={`flow-action-${index}`} className="rounded-xl border p-4">
                  <div className="mb-3 grid gap-3 md:grid-cols-[220px_1fr_auto]">
                    <label className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                        Tipo
                      </span>
                      <select
                        className="w-full rounded-lg border p-3"
                        value={hydratedAction.type}
                        onChange={(event) =>
                          updateAction(index, emptyAction(event.target.value))
                        }
                      >
                        {ACTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="text-sm text-gray-500 md:pt-9">
                      {hydratedAction.type === "setField"
                        ? "Asigna un valor directo o plantilla a un campo del mismo registro."
                        : null}
                      {hydratedAction.type === "setBoolean"
                        ? "Marca o desmarca un campo booleano del registro."
                        : null}
                      {hydratedAction.type === "setStatus"
                        ? "Actualiza el campo de estado del registro."
                        : null}
                      {hydratedAction.type === "createRecord"
                        ? "Crea un registro nuevo en otro objeto usando JSON y plantillas."
                        : null}
                    </div>

                    <div className="md:pt-8">
                      <button
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            actions: current.actions.filter((_, actionIndex) => actionIndex !== index),
                          }))
                        }
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>

                  {hydratedAction.type === "setField" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Campo destino</span>
                        <select
                          className="w-full rounded-lg border p-3"
                          value={hydratedAction.config?.field || ""}
                          onChange={(event) =>
                            updateActionConfig(index, { field: event.target.value })
                          }
                        >
                          <option value="">Selecciona un campo</option>
                          {objectFieldOptions}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Valor</span>
                        <input
                          className="w-full rounded-lg border p-3"
                          value={hydratedAction.config?.value ?? ""}
                          onChange={(event) =>
                            updateActionConfig(index, { value: event.target.value })
                          }
                          placeholder="Ej: Revisar, {{name}}, today+7"
                        />
                      </label>
                    </div>
                  ) : null}

                  {hydratedAction.type === "setBoolean" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Campo booleano</span>
                        <select
                          className="w-full rounded-lg border p-3"
                          value={hydratedAction.config?.field || ""}
                          onChange={(event) =>
                            updateActionConfig(index, { field: event.target.value })
                          }
                        >
                          <option value="">Selecciona un campo</option>
                          {sourceFields
                            .filter((field) => field.type === "boolean")
                            .map((field) => (
                              <option key={field.apiName} value={field.apiName}>
                                {field.label} ({field.apiName})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Valor</span>
                        <select
                          className="w-full rounded-lg border p-3"
                          value={String(Boolean(hydratedAction.config?.value))}
                          onChange={(event) =>
                            updateActionConfig(index, {
                              value: event.target.value === "true",
                            })
                          }
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {hydratedAction.type === "setStatus" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Campo status</span>
                        <select
                          className="w-full rounded-lg border p-3"
                          value={hydratedAction.config?.field || "status"}
                          onChange={(event) =>
                            updateActionConfig(index, { field: event.target.value })
                          }
                        >
                          <option value="status">status</option>
                          {objectFieldOptions}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Valor</span>
                        <input
                          className="w-full rounded-lg border p-3"
                          value={hydratedAction.config?.value || ""}
                          onChange={(event) =>
                            updateActionConfig(index, { value: event.target.value })
                          }
                          placeholder="Ej: Pendiente revisión"
                        />
                      </label>
                    </div>
                  ) : null}

                  {hydratedAction.type === "createRecord" ? (
                    <div className="grid gap-4">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Objeto destino</span>
                        <select
                          className="w-full rounded-lg border p-3"
                          value={hydratedAction.config?.object || ""}
                          onChange={(event) =>
                            updateActionConfig(index, { object: event.target.value })
                          }
                        >
                          <option value="">Selecciona un objeto</option>
                          {availableObjects.map((object) => (
                            <option key={object.apiName} value={object.apiName}>
                              {object.name} ({object.apiName})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Valores JSON</span>
                        <textarea
                          className="min-h-40 w-full rounded-lg border p-3 font-mono text-sm"
                          value={hydratedAction.config?.values || "{}"}
                          onChange={(event) =>
                            updateActionConfig(index, { values: event.target.value })
                          }
                          placeholder={`{\n  "title": "Seguimiento {{name}}"\n}`}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={handleDelete}
              disabled={!selectedId}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600 disabled:opacity-60"
            >
              Eliminar flow
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-black px-4 py-3 text-white disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar flow"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

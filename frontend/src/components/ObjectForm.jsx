import { useEffect, useState } from "react";
import { normalizeApiName } from "../engine/metadataEngine";

function optionsToMultiline(options = []) {
  return options.join("\n");
}

function multilineToOptions(value = "") {
  return value
    .split(/\r?\n/)
    .map((opt) => opt.trim())
    .filter(Boolean);
}

function renderDefaultValueInput(field, setField) {
  if (["formula", "rollup"].includes(field.type)) {
    return null;
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 rounded border p-2 md:col-span-2">
        <input
          type="checkbox"
          checked={Boolean(field.defaultValue)}
          onChange={(e) =>
            setField({ ...field, defaultValue: e.target.checked })
          }
        />
        Valor por defecto
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select
        className="rounded border p-2 md:col-span-2"
        value={field.defaultValue ?? ""}
        onChange={(e) =>
          setField({ ...field, defaultValue: e.target.value })
        }
      >
        <option value="">Sin valor por defecto</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      placeholder="Valor por defecto"
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      className="rounded border p-2 md:col-span-2"
      value={field.defaultValue ?? ""}
      onChange={(e) =>
        setField({ ...field, defaultValue: e.target.value })
      }
    />
  );
}

function ObjectForm({ initialData = null, onSave, saving = false }) {
  const emptyField = {
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
    defaultValue: "",
    referenceTo: "",
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
    formula: {
      expression: "",
      returnType: "text",
    },
    rollup: {
      relatedObject: "",
      relatedField: "",
      operation: "sum",
      fieldToAggregate: "",
      filterField: "",
      filterOperator: "eq",
      filterValue: "",
    },
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
      setFields(
        (initialData.fields || []).map((currentField) => ({
          ...emptyField,
          ...currentField,
          options: currentField.options || [],
          defaultValue:
            currentField.defaultValue ??
            (currentField.type === "boolean" ? false : ""),
          referenceTo: currentField.referenceTo || "",
          formula: {
            expression: currentField.formula?.expression || "",
            returnType: currentField.formula?.returnType || "text",
          },
          rollup: {
            relatedObject: currentField.rollup?.relatedObject || "",
            relatedField: currentField.rollup?.relatedField || "",
            operation: currentField.rollup?.operation || "sum",
            fieldToAggregate: currentField.rollup?.fieldToAggregate || "",
            filterField: currentField.rollup?.filterField || "",
            filterOperator: currentField.rollup?.filterOperator || "eq",
            filterValue: currentField.rollup?.filterValue ?? "",
          },
        }))
      );
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

    const finalApiName = field.apiName?.trim()
      ? normalizeApiName(field.apiName)
      : normalizeApiName(field.label);

    const exists = fields.some(
      (existingField) =>
        existingField.apiName === finalApiName &&
        existingField.apiName !== editingFieldApiName
    );

    if (exists) {
      alert("Ya existe un campo con ese API Name");
      return;
    }

    if (field.type === "lookup" && !field.referenceTo.trim()) {
      alert("Debes indicar el objeto relacionado para el campo lookup");
      return;
    }

    if (
      field.type === "select" &&
      (!field.options || field.options.length === 0)
    ) {
      alert("El campo select debe tener opciones");
      return;
    }

    if (field.type === "formula" && !field.formula?.expression?.trim()) {
      alert("El campo fórmula debe tener una expresión");
      return;
    }

    if (field.type === "rollup") {
      if (!field.rollup?.relatedObject?.trim()) {
        alert("El campo rollup debe tener relatedObject");
        return;
      }

      if (!field.rollup?.relatedField?.trim()) {
        alert("El campo rollup debe tener relatedField");
        return;
      }

      if (!field.rollup?.operation?.trim()) {
        alert("El campo rollup debe tener operation");
        return;
      }

      if (
        ["sum", "avg", "min", "max"].includes(field.rollup?.operation) &&
        !field.rollup?.fieldToAggregate?.trim()
      ) {
        alert("El campo rollup debe tener fieldToAggregate");
        return;
      }

      if (
        field.rollup?.operation === "count" &&
        field.rollup?.fieldToAggregate?.trim()
      ) {
        alert("COUNT no debe tener fieldToAggregate");
        return;
      }
    }

    const newField = {
      ...field,
      label: field.label.trim(),
      apiName: finalApiName,
      required:
        field.type === "formula" || field.type === "rollup"
          ? false
          : field.required,
      options: field.type === "select" ? field.options || [] : [],
      defaultValue:
        field.type === "formula" || field.type === "rollup"
          ? undefined
          : field.type === "boolean"
            ? Boolean(field.defaultValue)
            : String(field.defaultValue ?? "").trim(),
      referenceTo:
        field.type === "lookup"
          ? normalizeApiName(field.referenceTo)
          : "",
      visibleInForm:
        field.type === "rollup"
          ? false
          : field.visibleInForm,
      formula:
        field.type === "formula"
          ? {
              expression: String(field.formula?.expression || "").trim(),
              returnType: field.formula?.returnType || "text",
            }
          : {
              expression: "",
              returnType: "text",
            },
      rollup:
        field.type === "rollup"
          ? {
              relatedObject: normalizeApiName(
                field.rollup?.relatedObject || ""
              ),
              relatedField: normalizeApiName(
                field.rollup?.relatedField || ""
              ),
              operation: field.rollup?.operation || "sum",
              fieldToAggregate:
                field.rollup?.operation === "count"
                  ? ""
                  : normalizeApiName(field.rollup?.fieldToAggregate || ""),
              filterField: normalizeApiName(field.rollup?.filterField || ""),
              filterOperator: field.rollup?.filterOperator || "eq",
              filterValue: field.rollup?.filterValue ?? "",
            }
          : {
              relatedObject: "",
              relatedField: "",
              operation: "sum",
              fieldToAggregate: "",
              filterField: "",
              filterOperator: "eq",
              filterValue: "",
            },
    };

    if (editingFieldApiName) {
      setFields((prev) =>
        prev.map((currentField) =>
          currentField.apiName === editingFieldApiName ? newField : currentField
        )
      );
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

    const finalApiName = apiName.trim()
      ? normalizeApiName(apiName)
      : normalizeApiName(name);

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
        : [
            {
              label: "principal",
              apiName: "principal",
              sections: [
                {
                  label: "Detalles",
                  columns: 2,
                  fields: fields.map((currentField) => currentField.apiName),
                },
              ],
            },
          ],
      listViews: initialData?.listViews?.length
        ? initialData.listViews
        : [
            {
              label: "Todos",
              apiName: "all",
              isDefault: true,
              columns: fields
                .filter((currentField) => currentField.visibleInList !== false)
                .slice(0, 5)
                .map((currentField) => currentField.apiName),
              filters: [],
              sortBy: "createdAt",
              sortOrder: "desc",
            },
          ],
    };

    onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input
            className="w-full rounded border p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Plural Label</label>
          <input
            className="w-full rounded border p-2"
            value={pluralLabel}
            onChange={(e) => setPluralLabel(e.target.value)}
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

        <div>
          <label className="mb-1 block text-sm font-medium">Descripción</label>
          <input
            className="w-full rounded border p-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Activo
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={tabsEnabled}
            onChange={(e) => setTabsEnabled(e.target.checked)}
          />
          Mostrar tab
        </label>
      </div>

      <div>
        <h2 className="mb-3 font-bold">
          {editingFieldApiName ? "Editar campo" : "Campos"}
        </h2>

        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            placeholder="Label"
            className="rounded border p-2"
            value={field.label}
            onChange={(e) => setField({ ...field, label: e.target.value })}
          />

          <input
            placeholder="API Name"
            className="rounded border p-2"
            value={field.apiName}
            onChange={(e) => setField({ ...field, apiName: e.target.value })}
          />

          <select
            className="rounded border p-2"
            value={field.type}
            onChange={(e) =>
              setField({
                ...field,
                type: e.target.value,
                required:
                  e.target.value === "formula" || e.target.value === "rollup"
                    ? false
                    : field.required,
                options: e.target.value === "select" ? field.options || [] : [],
                referenceTo:
                  e.target.value === "lookup" ? field.referenceTo || "" : "",
                visibleInForm:
                  e.target.value === "rollup"
                    ? false
                    : field.visibleInForm,
                formula:
                  e.target.value === "formula"
                    ? field.formula || { expression: "", returnType: "text" }
                    : { expression: "", returnType: "text" },
                rollup:
                  e.target.value === "rollup"
                    ? field.rollup || {
                        relatedObject: "",
                        relatedField: "",
                        operation: "sum",
                        fieldToAggregate: "",
                        filterField: "",
                        filterOperator: "eq",
                        filterValue: "",
                      }
                    : {
                        relatedObject: "",
                        relatedField: "",
                        operation: "sum",
                        fieldToAggregate: "",
                        filterField: "",
                        filterOperator: "eq",
                        filterValue: "",
                      },
              })
            }
          >
            <option value="text">Text</option>
            <option value="textarea">Textarea</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="date">Date</option>
            <option value="boolean">Boolean</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="url">URL</option>
            <option value="lookup">Lookup</option>
            <option value="formula">Formula</option>
            <option value="rollup">Rollup</option>
          </select>

          <label className="flex items-center gap-2 rounded border p-2">
            <input
              type="checkbox"
              checked={
                field.type === "formula" || field.type === "rollup"
                  ? false
                  : field.required
              }
              disabled={field.type === "formula" || field.type === "rollup"}
              onChange={(e) =>
                setField({ ...field, required: e.target.checked })
              }
            />
            Required
          </label>

          {field.type === "select" && (
            <>
              <textarea
                placeholder={"Una opcion por linea\nActivo\nInactivo\nPendiente, con coma"}
                className="rounded border p-2 md:col-span-2"
                rows={4}
                value={optionsToMultiline(field.options)}
                onChange={(e) =>
                  setField({
                    ...field,
                    options: multilineToOptions(e.target.value),
                  })
                }
              />
              <select
                className="rounded border p-2 md:col-span-2"
                value={field.defaultValue ?? ""}
                onChange={(e) =>
                  setField({ ...field, defaultValue: e.target.value })
                }
              >
                <option value="">Sin valor por defecto</option>
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          )}

          {field.type === "lookup" && (
            <input
              placeholder="Objeto relacionado (ej: customer)"
              className="rounded border p-2 md:col-span-2"
              value={field.referenceTo || ""}
              onChange={(e) =>
                setField({
                  ...field,
                  referenceTo: e.target.value,
                })
              }
            />
          )}

          {!["select", "lookup", "formula", "rollup"].includes(field.type) &&
            renderDefaultValueInput(field, setField)}

          {field.type === "lookup" && renderDefaultValueInput(field, setField)}

          {field.type === "formula" && (
            <>
              <input
                placeholder='Expresión (ej: firstName + " " + lastName)'
                className="rounded border p-2 md:col-span-2"
                value={field.formula?.expression || ""}
                onChange={(e) =>
                  setField({
                    ...field,
                    formula: {
                      ...field.formula,
                      expression: e.target.value,
                    },
                  })
                }
              />

              <select
                className="rounded border p-2 md:col-span-2"
                value={field.formula?.returnType || "text"}
                onChange={(e) =>
                  setField({
                    ...field,
                    formula: {
                      ...field.formula,
                      returnType: e.target.value,
                    },
                  })
                }
              >
                <option value="text">Return: Text</option>
                <option value="number">Return: Number</option>
                <option value="boolean">Return: Boolean</option>
                <option value="date">Return: Date</option>
              </select>
            </>
          )}

          {field.type === "rollup" && (
            <>
              <input
                placeholder="Objeto relacionado (ej: detalle_venta)"
                className="rounded border p-2 md:col-span-2"
                value={field.rollup?.relatedObject || ""}
                onChange={(e) =>
                  setField({
                    ...field,
                    rollup: {
                      ...field.rollup,
                      relatedObject: e.target.value,
                    },
                  })
                }
              />

              <input
                placeholder="Campo relación en hijo (ej: venta_id)"
                className="rounded border p-2 md:col-span-2"
                value={field.rollup?.relatedField || ""}
                onChange={(e) =>
                  setField({
                    ...field,
                    rollup: {
                      ...field.rollup,
                      relatedField: e.target.value,
                    },
                  })
                }
              />

              <select
                className="rounded border p-2 md:col-span-2"
                value={field.rollup?.operation || "sum"}
                onChange={(e) =>
                  setField({
                    ...field,
                    rollup: {
                      ...field.rollup,
                      operation: e.target.value,
                      fieldToAggregate:
                        e.target.value === "count"
                          ? ""
                          : field.rollup?.fieldToAggregate || "",
                    },
                  })
                }
              >
                <option value="sum">SUM</option>
                <option value="count">COUNT</option>
                <option value="avg">AVG</option>
                <option value="min">MIN</option>
                <option value="max">MAX</option>
              </select>

              {field.rollup?.operation !== "count" && (
                <input
                  placeholder="Campo a resumir (ej: total)"
                  className="rounded border p-2 md:col-span-2"
                  value={field.rollup?.fieldToAggregate || ""}
                  onChange={(e) =>
                    setField({
                      ...field,
                      rollup: {
                        ...field.rollup,
                        fieldToAggregate: e.target.value,
                      },
                    })
                  }
                />
              )}

              <input
                placeholder="Filtro campo (opcional)"
                className="rounded border p-2 md:col-span-2"
                value={field.rollup?.filterField || ""}
                onChange={(e) =>
                  setField({
                    ...field,
                    rollup: {
                      ...field.rollup,
                      filterField: e.target.value,
                    },
                  })
                }
              />

              <select
                className="rounded border p-2 md:col-span-2"
                value={field.rollup?.filterOperator || "eq"}
                onChange={(e) =>
                  setField({
                    ...field,
                    rollup: {
                      ...field.rollup,
                      filterOperator: e.target.value,
                    },
                  })
                }
              >
                <option value="eq">Equals</option>
                <option value="ne">Not equals</option>
                <option value="gt">Greater than</option>
                <option value="gte">Greater or equal</option>
                <option value="lt">Less than</option>
                <option value="lte">Less or equal</option>
                <option value="contains">Contains</option>
              </select>

              <input
                placeholder="Filtro valor (opcional)"
                className="rounded border p-2 md:col-span-2"
                value={field.rollup?.filterValue ?? ""}
                onChange={(e) =>
                  setField({
                    ...field,
                    rollup: {
                      ...field.rollup,
                      filterValue: e.target.value,
                    },
                  })
                }
              />
            </>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.visibleInList}
              onChange={(e) =>
                setField({ ...field, visibleInList: e.target.checked })
              }
            />
            Visible en lista
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.visibleInForm}
              disabled={field.type === "rollup"}
              onChange={(e) =>
                setField({ ...field, visibleInForm: e.target.checked })
              }
            />
            Visible en formulario
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.visibleInDetail}
              onChange={(e) =>
                setField({ ...field, visibleInDetail: e.target.checked })
              }
            />
            Visible en detalle
          </label>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={addOrUpdateField}
            className="rounded bg-gray-200 px-4 py-2"
            type="button"
          >
            {editingFieldApiName ? "Actualizar campo" : "Agregar campo"}
          </button>

          {editingFieldApiName && (
            <button
              onClick={resetFieldForm}
              className="rounded bg-gray-100 px-4 py-2"
              type="button"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <div className="space-y-2">
          {fields.map((currentField) => (
            <div
              key={currentField.apiName}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <div className="font-medium">
                  {currentField.label} - {currentField.apiName}
                </div>

                <div className="text-sm text-gray-500">
                  {currentField.type}
                  {currentField.required ? " · requerido" : ""}
                  {currentField.type === "lookup" && currentField.referenceTo
                    ? ` · referencia a ${currentField.referenceTo}`
                    : ""}
                  {currentField.type === "formula" &&
                  currentField.formula?.expression
                    ? ` · ${currentField.formula.expression}`
                    : ""}
                  {currentField.type === "rollup" &&
                  currentField.rollup?.relatedObject
                    ? ` · ${currentField.rollup.operation}(${currentField.rollup.fieldToAggregate || "*"}) de ${currentField.rollup.relatedObject}.${currentField.rollup.relatedField}`
                    : ""}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-yellow-500 px-3 py-1 text-white"
                  onClick={() => {
                    setField({
                      ...emptyField,
                      ...currentField,
                      options: currentField.options || [],
                      defaultValue:
                        currentField.defaultValue ??
                        (currentField.type === "boolean" ? false : ""),
                      referenceTo: currentField.referenceTo || "",
                      formula: {
                        expression: currentField.formula?.expression || "",
                        returnType: currentField.formula?.returnType || "text",
                      },
                      rollup: {
                        relatedObject: currentField.rollup?.relatedObject || "",
                        relatedField: currentField.rollup?.relatedField || "",
                        operation: currentField.rollup?.operation || "sum",
                        fieldToAggregate: currentField.rollup?.fieldToAggregate || "",
                        filterField: currentField.rollup?.filterField || "",
                        filterOperator: currentField.rollup?.filterOperator || "eq",
                        filterValue: currentField.rollup?.filterValue ?? "",
                      },
                    });
                    setEditingFieldApiName(currentField.apiName);
                  }}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className="rounded bg-red-600 px-3 py-1 text-white"
                  onClick={() =>
                    setFields((prev) =>
                      prev.filter((item) => item.apiName !== currentField.apiName)
                    )
                  }
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          disabled={saving}
          onClick={handleSubmit}
          type="button"
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar objeto"}
        </button>
      </div>
    </div>
  );
}

export default ObjectForm;

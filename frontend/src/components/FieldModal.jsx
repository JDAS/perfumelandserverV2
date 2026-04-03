import { useEffect, useState } from "react";
import { normalizeApiName } from "../engine/metadataEngine";

function FieldModal({ open, onClose, onSave, initialData = null }) {
  const emptyField = {
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
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

  const [field, setField] = useState(emptyField);

  useEffect(() => {
    if (initialData) {
      setField({
        ...emptyField,
        ...initialData,
        options: initialData.options || [],
        referenceTo: initialData.referenceTo || "",
        formula: {
          expression: initialData.formula?.expression || "",
          returnType: initialData.formula?.returnType || "text",
        },
        rollup: {
          relatedObject: initialData.rollup?.relatedObject || "",
          relatedField: initialData.rollup?.relatedField || "",
          operation: initialData.rollup?.operation || "sum",
          fieldToAggregate: initialData.rollup?.fieldToAggregate || "",
          filterField: initialData.rollup?.filterField || "",
          filterOperator: initialData.rollup?.filterOperator || "eq",
          filterValue: initialData.rollup?.filterValue ?? "",
        },
      });
    } else {
      setField(emptyField);
    }
  }, [initialData, open]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!field.label.trim()) {
      alert("El label es obligatorio");
      return;
    }

    if (field.type === "lookup" && !field.referenceTo?.trim()) {
      alert("Debe indicar el objeto relacionado para el lookup");
      return;
    }

    if (field.type === "formula" && !field.formula?.expression?.trim()) {
      alert("Debe indicar la expresión de la fórmula");
      return;
    }

    if (field.type === "rollup") {
      if (!field.rollup?.relatedObject?.trim()) {
        alert("Debe indicar el objeto relacionado del rollup");
        return;
      }

      if (!field.rollup?.relatedField?.trim()) {
        alert("Debe indicar el campo relación del rollup");
        return;
      }

      if (!field.rollup?.operation?.trim()) {
        alert("Debe indicar la operación del rollup");
        return;
      }

      if (
        ["sum", "avg", "min", "max"].includes(field.rollup?.operation) &&
        !field.rollup?.fieldToAggregate?.trim()
      ) {
        alert("Debe indicar el campo a resumir");
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

    const finalField = {
      ...field,
      apiName: field.apiName?.trim()
        ? normalizeApiName(field.apiName)
        : normalizeApiName(field.label),
      required:
        field.type === "formula" || field.type === "rollup"
          ? false
          : field.required,
      options: field.type === "select" ? field.options : [],
      referenceTo:
        field.type === "lookup"
          ? normalizeApiName(field.referenceTo || "")
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

    onSave(finalField);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-bold">
            {initialData ? "Editar campo" : "Nuevo campo"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Label</label>
            <input
              className="w-full rounded border p-2"
              value={field.label}
              onChange={(e) =>
                setField({ ...field, label: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">API Name</label>
            <input
              className="w-full rounded border p-2"
              value={field.apiName}
              onChange={(e) =>
                setField({ ...field, apiName: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              className="w-full rounded border p-2"
              value={field.type}
              onChange={(e) => {
                const nextType = e.target.value;

                setField({
                  ...field,
                  type: nextType,
                  required:
                    nextType === "formula" || nextType === "rollup"
                      ? false
                      : field.required,
                  options: nextType === "select" ? field.options || [] : [],
                  referenceTo:
                    nextType === "lookup" ? field.referenceTo || "" : "",
                  visibleInForm:
                    nextType === "rollup"
                      ? false
                      : field.visibleInForm,
                  formula:
                    nextType === "formula"
                      ? field.formula || {
                          expression: "",
                          returnType: "text",
                        }
                      : { expression: "", returnType: "text" },
                  rollup:
                    nextType === "rollup"
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
                });
              }}
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
          </div>

          <label className="flex items-center gap-2">
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
            <span>Requerido</span>
          </label>

          {field.type === "select" && (
            <div>
              <label className="mb-1 block text-sm font-medium">Opciones</label>
              <input
                className="w-full rounded border p-2"
                value={(field.options || []).join(", ")}
                onChange={(e) =>
                  setField({
                    ...field,
                    options: e.target.value
                      .split(",")
                      .map((opt) => opt.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Ej: Activo, Inactivo, Pendiente"
              />
            </div>
          )}

          {field.type === "lookup" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Objeto relacionado
              </label>
              <input
                className="w-full rounded border p-2"
                value={field.referenceTo || ""}
                onChange={(e) =>
                  setField({
                    ...field,
                    referenceTo: e.target.value,
                  })
                }
                placeholder="Ej: customer"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ingresá el API Name del objeto relacionado.
              </p>
            </div>
          )}

          {field.type === "formula" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Expresión
                </label>
                <input
                  className="w-full rounded border p-2"
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
                  placeholder={`Ej: firstName + " " + lastName`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ejemplos: quantity * price, IF(status == "closed", "Cerrado", "Abierto")
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tipo de retorno
                </label>
                <select
                  className="w-full rounded border p-2"
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
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                </select>
              </div>
            </div>
          )}

          {field.type === "rollup" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Objeto relacionado
                </label>
                <input
                  className="w-full rounded border p-2"
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
                  placeholder="Ej: detalle_venta"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Campo relación en hijo
                </label>
                <input
                  className="w-full rounded border p-2"
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
                  placeholder="Ej: venta_id"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Operación
                </label>
                <select
                  className="w-full rounded border p-2"
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
              </div>

              {field.rollup?.operation !== "count" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Campo a resumir
                  </label>
                  <input
                    className="w-full rounded border p-2"
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
                    placeholder="Ej: total"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Filtro campo
                </label>
                <input
                  className="w-full rounded border p-2"
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
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Filtro operador
                </label>
                <select
                  className="w-full rounded border p-2"
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
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Filtro valor
                </label>
                <input
                  className="w-full rounded border p-2"
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
                  placeholder="Opcional"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.visibleInList}
                onChange={(e) =>
                  setField({ ...field, visibleInList: e.target.checked })
                }
              />
              Lista
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
              Formulario
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.visibleInDetail}
                onChange={(e) =>
                  setField({ ...field, visibleInDetail: e.target.checked })
                }
              />
              Detalle
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded bg-gray-200 px-4 py-2"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-white"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FieldModal;
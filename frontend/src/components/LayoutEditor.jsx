import { useMemo, useState } from "react";
import { normalizeApiName } from "../engine/metadataEngine";
import { useObjectMetadata } from "../context/ObjectMetadataContext";

function createEmptyFieldSection() {
  return {
    label: "Nueva sección",
    type: "fields",
    columns: 2,
    fields: [],
    relatedObject: "",
    relatedField: "",
    relatedColumns: [],
  };
}

function createEmptyRelatedListSection() {
  return {
    label: "Nueva lista relacionada",
    type: "relatedList",
    columns: 1,
    fields: [],
    relatedObject: "",
    relatedField: "",
    relatedColumns: [],
  };
}

function LayoutEditor({ layout, allFields = [], onSave, onCancel }) {
  const { objects = [] } = useObjectMetadata();
  const [draft, setDraft] = useState(() => ({
    ...layout,
    label: layout?.label || "",
    apiName: layout?.apiName || "",
    sections: (layout?.sections || []).map((section) => ({
      label: section.label || "",
      type: section.type === "relatedList" ? "relatedList" : "fields",
      columns: Number(section.columns) === 2 ? 2 : 1,
      fields: Array.isArray(section.fields) ? section.fields : [],
      relatedObject: section.relatedObject || "",
      relatedField: section.relatedField || "",
      relatedColumns: Array.isArray(section.relatedColumns)
        ? section.relatedColumns
        : [],
    })),
  }));

  const objectOptions = useMemo(() => {
    return objects.map((obj) => ({
      apiName: obj.apiName,
      label: obj.name || obj.label || obj.apiName,
      fields: obj.fields || [],
    }));
  }, [objects]);

  const getRelatedObjectDef = (apiName) =>
    objectOptions.find((obj) => obj.apiName === apiName);

  const updateSection = (index, patch) => {
    setDraft((prev) => {
      const nextSections = [...(prev.sections || [])];
      nextSections[index] = {
        ...nextSections[index],
        ...patch,
      };
      return {
        ...prev,
        sections: nextSections,
      };
    });
  };

  const addFieldSection = () => {
    setDraft((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), createEmptyFieldSection()],
    }));
  };

  const addRelatedListSection = () => {
    setDraft((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), createEmptyRelatedListSection()],
    }));
  };

  const removeSection = (index) => {
    setDraft((prev) => ({
      ...prev,
      sections: (prev.sections || []).filter((_, i) => i !== index),
    }));
  };

  const moveSection = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= (draft.sections || []).length) return;

    const next = [...draft.sections];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    setDraft((prev) => ({
      ...prev,
      sections: next,
    }));
  };

  const toggleFieldInSection = (sectionIndex, fieldApiName) => {
    const section = draft.sections[sectionIndex];
    const current = section.fields || [];
    const exists = current.includes(fieldApiName);

    updateSection(sectionIndex, {
      fields: exists
        ? current.filter((item) => item !== fieldApiName)
        : [...current, fieldApiName],
    });
  };

  const toggleRelatedColumn = (sectionIndex, fieldApiName) => {
    const section = draft.sections[sectionIndex];
    const current = section.relatedColumns || [];
    const exists = current.includes(fieldApiName);

    updateSection(sectionIndex, {
      relatedColumns: exists
        ? current.filter((item) => item !== fieldApiName)
        : [...current, fieldApiName],
    });
  };

  const addBlankBlock = (sectionIndex) => {
    const section = draft.sections[sectionIndex];
    const current = section.fields || [];
    const blankId = `__blank__${Date.now()}`;

    updateSection(sectionIndex, {
      fields: [...current, blankId],
    });
  };

  const removeFieldItem = (sectionIndex, itemValue) => {
    const section = draft.sections[sectionIndex];
    updateSection(sectionIndex, {
      fields: (section.fields || []).filter((item) => item !== itemValue),
    });
  };

  const moveFieldItem = (sectionIndex, itemIndex, direction) => {
    const section = draft.sections[sectionIndex];
    const items = [...(section.fields || [])];
    const targetIndex = itemIndex + direction;

    if (targetIndex < 0 || targetIndex >= items.length) return;

    [items[itemIndex], items[targetIndex]] = [items[targetIndex], items[itemIndex]];

    updateSection(sectionIndex, { fields: items });
  };

  const handleSave = () => {
    if (!draft.label.trim()) {
      alert("El layout debe tener label");
      return;
    }

    const finalLayout = {
      ...draft,
      label: draft.label.trim(),
      apiName: draft.apiName?.trim()
        ? normalizeApiName(draft.apiName)
        : normalizeApiName(draft.label),
      sections: (draft.sections || []).map((section, index) => ({
        label: String(section.label || `Sección ${index + 1}`).trim(),
        type: section.type === "relatedList" ? "relatedList" : "fields",
        columns: section.type === "fields" ? (Number(section.columns) === 2 ? 2 : 1) : 1,
        fields:
          section.type === "fields"
            ? Array.isArray(section.fields)
              ? section.fields
              : []
            : [],
        relatedObject:
          section.type === "relatedList"
            ? normalizeApiName(section.relatedObject || "")
            : "",
        relatedField:
          section.type === "relatedList"
            ? normalizeApiName(section.relatedField || "")
            : "",
        relatedColumns:
          section.type === "relatedList" && Array.isArray(section.relatedColumns)
            ? section.relatedColumns
            : [],
      })),
    };

    const invalidRelated = finalLayout.sections.find(
      (section) =>
        section.type === "relatedList" &&
        (!section.relatedObject || !section.relatedField)
    );

    if (invalidRelated) {
      alert(`La sección "${invalidRelated.label}" debe tener objeto y campo relacionado`);
      return;
    }

    onSave(finalLayout);
  };

  return (
    <div className="space-y-6 rounded-xl bg-white p-6 shadow">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Editar layout</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-gray-200 px-4 py-2"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded bg-black px-4 py-2 text-white"
            onClick={handleSave}
          >
            Guardar layout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Label</label>
          <input
            className="w-full rounded border p-2"
            value={draft.label}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, label: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">API Name</label>
          <input
            className="w-full rounded border p-2"
            value={draft.apiName}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, apiName: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-gray-100 px-4 py-2"
          onClick={addFieldSection}
        >
          Agregar sección de campos
        </button>

        <button
          type="button"
          className="rounded bg-gray-100 px-4 py-2"
          onClick={addRelatedListSection}
        >
          Agregar lista relacionada
        </button>
      </div>

      <div className="space-y-4">
        {(draft.sections || []).map((section, sectionIndex) => {
          const relatedObjectDef = getRelatedObjectDef(section.relatedObject);
          const relatedFields = relatedObjectDef?.fields || [];

          return (
            <div
              key={`${section.label}-${sectionIndex}`}
              className="space-y-4 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Label</label>
                    <input
                      className="w-full rounded border p-2"
                      value={section.label || ""}
                      onChange={(e) =>
                        updateSection(sectionIndex, { label: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Tipo</label>
                    <select
                      className="w-full rounded border p-2"
                      value={section.type || "fields"}
                      onChange={(e) => {
                        const nextType = e.target.value;

                        updateSection(sectionIndex, {
                          type: nextType,
                          columns: nextType === "fields" ? 2 : 1,
                          fields: nextType === "fields" ? section.fields || [] : [],
                          relatedObject:
                            nextType === "relatedList" ? section.relatedObject || "" : "",
                          relatedField:
                            nextType === "relatedList" ? section.relatedField || "" : "",
                          relatedColumns:
                            nextType === "relatedList"
                              ? section.relatedColumns || []
                              : [],
                        });
                      }}
                    >
                      <option value="fields">Campos</option>
                      <option value="relatedList">Lista relacionada</option>
                    </select>
                  </div>

                  {section.type === "fields" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium">Columnas</label>
                      <select
                        className="w-full rounded border p-2"
                        value={Number(section.columns) === 2 ? 2 : 1}
                        onChange={(e) =>
                          updateSection(sectionIndex, {
                            columns: Number(e.target.value) === 2 ? 2 : 1,
                          })
                        }
                      >
                        <option value={1}>1 columna</option>
                        <option value={2}>2 columnas</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Objeto relacionado
                      </label>
                      <select
                        className="w-full rounded border p-2"
                        value={section.relatedObject || ""}
                        onChange={(e) =>
                          updateSection(sectionIndex, {
                            relatedObject: e.target.value,
                            relatedField: "",
                            relatedColumns: [],
                          })
                        }
                      >
                        <option value="">Seleccione</option>
                        {objectOptions.map((obj) => (
                          <option key={obj.apiName} value={obj.apiName}>
                            {obj.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded bg-gray-100 px-3 py-2"
                    onClick={() => moveSection(sectionIndex, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded bg-gray-100 px-3 py-2"
                    onClick={() => moveSection(sectionIndex, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-2 text-white"
                    onClick={() => removeSection(sectionIndex)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {section.type === "fields" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border px-3 py-2 text-sm"
                      onClick={() => addBlankBlock(sectionIndex)}
                    >
                      Agregar espacio en blanco
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Campos disponibles
                    </label>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      {allFields.map((field) => (
                        <label
                          key={field.apiName}
                          className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={(section.fields || []).includes(field.apiName)}
                            onChange={() =>
                              toggleFieldInSection(sectionIndex, field.apiName)
                            }
                          />
                          {field.label} ({field.apiName})
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Orden actual de la sección
                    </label>
                    <div className="space-y-2">
                      {(section.fields || []).map((item, itemIndex) => {
                        const fieldDef = allFields.find((f) => f.apiName === item);
                        const label = String(item).startsWith("__blank__")
                          ? "Espacio en blanco"
                          : fieldDef
                          ? `${fieldDef.label} (${fieldDef.apiName})`
                          : item;

                        return (
                          <div
                            key={`${item}-${itemIndex}`}
                            className="flex items-center justify-between rounded border px-3 py-2"
                          >
                            <span className="text-sm">{label}</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded bg-gray-100 px-2 py-1"
                                onClick={() =>
                                  moveFieldItem(sectionIndex, itemIndex, -1)
                                }
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="rounded bg-gray-100 px-2 py-1"
                                onClick={() =>
                                  moveFieldItem(sectionIndex, itemIndex, 1)
                                }
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="rounded bg-red-600 px-2 py-1 text-white"
                                onClick={() =>
                                  removeFieldItem(sectionIndex, item)
                                }
                              >
                                X
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {!(section.fields || []).length && (
                        <p className="text-sm text-gray-500">
                          Esta sección no tiene campos todavía.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Campo relacionado
                      </label>
                      <input
                        className="w-full rounded border p-2"
                        value={section.relatedField || ""}
                        onChange={(e) =>
                          updateSection(sectionIndex, {
                            relatedField: e.target.value,
                          })
                        }
                        placeholder="Ej: customerId"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Campo del objeto relacionado que guarda el id del registro actual.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Columnas a mostrar
                    </label>

                    {section.relatedObject ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {relatedFields.map((field) => (
                          <label
                            key={field.apiName}
                            className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={(section.relatedColumns || []).includes(
                                field.apiName
                              )}
                              onChange={() =>
                                toggleRelatedColumn(sectionIndex, field.apiName)
                              }
                            />
                            {field.label} ({field.apiName})
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Seleccioná primero el objeto relacionado.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {!(draft.sections || []).length && (
          <p className="text-sm text-gray-500">No hay secciones en este layout.</p>
        )}
      </div>
    </div>
  );
}

export default LayoutEditor;
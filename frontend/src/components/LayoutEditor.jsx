import { useMemo, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { useToast } from "./ui/ToastContext";

function LayoutEditor({ layout, allFields, onSave, onCancel }) {
  const { objects = [] } = useObjectMetadata();
  const { addToast } = useToast();

  const [localLayout, setLocalLayout] = useState(
    JSON.parse(JSON.stringify(layout))
  );

  const normalizeSections = (sections = []) =>
    sections.map((section, index) => ({
      id: section.id || `section_${index}_${section.apiName || section.label}`,
      label: section.label || "Nueva sección",
      label: section.label || "",
      type: section.type === "relatedList" ? "relatedList" : "fields",
      columns: section.type === "relatedList" ? 1 : section.columns || 1,
      fields: section.fields || [],
      relatedObject: section.relatedObject || "",
      relatedField: section.relatedField || "",
      relatedColumns: section.relatedColumns || [],
    }));

  const [sections, setSections] = useState(
    normalizeSections(localLayout.sections || [])
  );

  const sectionsWithDisplaySettings = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        showLabel:
          section.showLabel !== undefined
            ? section.showLabel
            : Boolean(String(section.label || "").trim()),
      })),
    [sections]
  );

  const isBlankBlock = (value) =>
    typeof value === "string" && value.startsWith("__blank__");

  const getFieldByApiName = (apiName) =>
    allFields.find((field) => field.apiName === apiName);

  const getObjectByApiName = (apiName) =>
    objects.find((obj) => obj.apiName === apiName);

  const assignedFieldApiNames = useMemo(() => {
    return sections
      .filter((section) => section.type !== "relatedList")
      .flatMap((section) =>
        (section.fields || []).filter((item) => !isBlankBlock(item))
      );
  }, [sections]);

  const availableFields = useMemo(() => {
    return allFields.filter(
      (field) => !assignedFieldApiNames.includes(field.apiName)
    );
  }, [allFields, assignedFieldApiNames]);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `section_${Date.now()}`,
        showLabel: false,
        label: "",
        label: "Nueva sección",
        label: "",
        type: "fields",
        columns: 2,
        fields: [],
        relatedObject: "",
        relatedField: "",
        relatedColumns: [],
      },
    ]);
  };

  const addRelatedListSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `section_${Date.now()}`,
        showLabel: false,
        label: "",
        label: "Nueva lista relacionada",
        label: "",
        type: "relatedList",
        columns: 1,
        fields: [],
        relatedObject: "",
        relatedField: "",
        relatedColumns: [],
      },
    ]);
  };

  const updateSection = (sectionId, changes) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, ...changes } : section
      )
    );
  };

  const deleteSection = (sectionId) => {
    setSections((prev) => prev.filter((section) => section.id !== sectionId));
  };

  const addBlankBlock = (sectionId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [...(section.fields || []), `__blank__${Date.now()}`],
            }
          : section
      )
    );
  };

  const removeItemFromAllSections = (value, sourceSections) => {
    return sourceSections.map((section) => {
      if (section.type === "relatedList") return section;

      return {
        ...section,
        fields: (section.fields || []).filter((item) => item !== value),
      };
    });
  };

  const reorder = (list, startIndex, endIndex) => {
    const result = [...list];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const splitFieldsIntoColumns = (fieldList = []) => {
    const col1 = [];
    const col2 = [];

    fieldList.forEach((item, index) => {
      if (index % 2 === 0) {
        col1.push({ value: item, originalIndex: index });
      } else {
        col2.push({ value: item, originalIndex: index });
      }
    });

    return { col1, col2 };
  };

  const mergeColumns = (col1 = [], col2 = []) => {
    const merged = [];
    const max = Math.max(col1.length, col2.length);

    for (let i = 0; i < max; i++) {
      if (col1[i] !== undefined) merged.push(col1[i]);
      if (col2[i] !== undefined) merged.push(col2[i]);
    }

    return merged;
  };

  const parseDroppableId = (id) => {
    if (id === "available") return { type: "available" };

    const [sectionId, column] = id.split("__");
    return { type: "section", sectionId, column };
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const sourceMeta = parseDroppableId(source.droppableId);
    const destinationMeta = parseDroppableId(destination.droppableId);

    if (
      source.droppableId === destination.droppableId &&
      sourceMeta.type === "section"
    ) {
      setSections((prev) =>
        prev.map((section) => {
          if (section.id !== sourceMeta.sectionId) return section;
          if (section.type === "relatedList") return section;

          const { col1, col2 } = splitFieldsIntoColumns(section.fields || []);
          const sourceColumnItems =
            sourceMeta.column === "col1"
              ? col1.map((x) => x.value)
              : col2.map((x) => x.value);

          const reorderedColumn = reorder(
            sourceColumnItems,
            source.index,
            destination.index
          );

          const newCol1 =
            sourceMeta.column === "col1"
              ? reorderedColumn
              : col1.map((x) => x.value);

          const newCol2 =
            sourceMeta.column === "col2"
              ? reorderedColumn
              : col2.map((x) => x.value);

          return {
            ...section,
            fields: mergeColumns(newCol1, newCol2),
          };
        })
      );
      return;
    }

    let updatedSections = removeItemFromAllSections(draggableId, sections);

    if (destinationMeta.type === "section") {
      updatedSections = updatedSections.map((section) => {
        if (section.id !== destinationMeta.sectionId) return section;
        if (section.type === "relatedList") return section;

        const { col1, col2 } = splitFieldsIntoColumns(section.fields || []);

        const targetCol =
          destinationMeta.column === "col1"
            ? col1.map((x) => x.value)
            : col2.map((x) => x.value);

        targetCol.splice(destination.index, 0, draggableId);

        const newCol1 =
          destinationMeta.column === "col1"
            ? targetCol
            : col1.map((x) => x.value);

        const newCol2 =
          destinationMeta.column === "col2"
            ? targetCol
            : col2.map((x) => x.value);

        return {
          ...section,
          fields: mergeColumns(newCol1, newCol2),
        };
      });
    }

    setSections(updatedSections);
  };

  const renderItemCard = (value, providedDraggable, snapshotDraggable) => {
    if (isBlankBlock(value)) {
      return (
        <div
          ref={providedDraggable.innerRef}
          {...providedDraggable.draggableProps}
          {...providedDraggable.dragHandleProps}
          className={`rounded border-2 border-dashed bg-gray-50 p-3 shadow-sm ${
            snapshotDraggable.isDragging ? "opacity-70" : ""
          }`}
        >
          <p className="font-medium text-gray-500">Bloque vacío</p>
          <p className="text-xs text-gray-400">Separador visual</p>
        </div>
      );
    }

    const field = getFieldByApiName(value);
    if (!field) return null;

    return (
      <div
        ref={providedDraggable.innerRef}
        {...providedDraggable.draggableProps}
        {...providedDraggable.dragHandleProps}
        className={`rounded border bg-white p-3 shadow-sm ${
          snapshotDraggable.isDragging ? "opacity-70" : ""
        }`}
      >
        <p className="font-medium">{field.label}</p>
        <p className="text-xs text-gray-500">
          {field.apiName} · {field.type}
          {field.required ? " · requerido" : ""}
        </p>
      </div>
    );
  };

  const toggleRelatedColumn = (sectionId, fieldApiName) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;

        const current = section.relatedColumns || [];
        const exists = current.includes(fieldApiName);

        return {
          ...section,
          relatedColumns: exists
            ? current.filter((item) => item !== fieldApiName)
            : [...current, fieldApiName],
        };
      })
    );
  };

  const handleSave = () => {
    const assignedFields = sections
      .filter((section) => section.type !== "relatedList")
      .flatMap((section) =>
        (section.fields || []).filter((item) => !isBlankBlock(item))
      );

    const requiredFields = allFields
      .filter((field) => field.required)
      .map((field) => field.apiName);

    const missingRequired = requiredFields.filter(
      (apiName) => !assignedFields.includes(apiName)
    );

    if (missingRequired.length > 0) {
      addToast(
        `Estos campos requeridos deben estar en alguna sección: ${missingRequired.join(
          ", "
        )}`
      );
      return;
    }

    const invalidRelatedList = sections.find(
      (section) =>
        section.type === "relatedList" &&
        (!section.relatedObject || !section.relatedField)
    );

    if (invalidRelatedList) {
      addToast(
        `La lista relacionada "${invalidRelatedList.label || "sin titulo"}" debe tener objeto relacionado y campo relacionado`,
        "warning"
      );
      return;
    }

    const cleanedLayout = {
      ...localLayout,
      sections: sections.map(({ id, ...section }) => ({
        ...section,
        label: section.showLabel === false ? "" : section.label || "",
        type: section.type === "relatedList" ? "relatedList" : "fields",
        columns:
          section.type === "relatedList"
            ? 1
            : Number(section.columns) === 2
            ? 2
            : 1,
        fields: section.type === "relatedList" ? [] : section.fields || [],
        relatedObject:
          section.type === "relatedList" ? section.relatedObject || "" : "",
        relatedField:
          section.type === "relatedList" ? section.relatedField || "" : "",
        relatedColumns:
          section.type === "relatedList" ? section.relatedColumns || [] : [],
      })),
    };

    onSave(cleanedLayout);
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Editar layout</h2>
        <p className="text-sm text-gray-500">
          {localLayout.label} · {localLayout.apiName}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={addSection}
          className="bg-gray-200 px-4 py-2 rounded"
        >
          Agregar sección
        </button>
        <button
          type="button"
          onClick={addRelatedListSection}
          className="bg-gray-200 px-4 py-2 rounded"
        >
          Agregar lista relacionada
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Disponibles */}
          <div className="lg:col-span-1">
            <h3 className="font-semibold mb-3">Campos disponibles</h3>

            <Droppable droppableId="available">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[200px] rounded-lg border p-3 space-y-2 ${
                    snapshot.isDraggingOver ? "bg-gray-100" : "bg-gray-50"
                  }`}
                >
                  {availableFields.map((field, index) => (
                    <Draggable
                      key={field.apiName}
                      draggableId={field.apiName}
                      index={index}
                    >
                      {(providedDraggable, snapshotDraggable) =>
                        renderItemCard(
                          field.apiName,
                          providedDraggable,
                          snapshotDraggable
                        )
                      }
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {availableFields.length === 0 && (
                    <p className="text-sm text-gray-500">
                      No hay campos disponibles
                    </p>
                  )}
                </div>
              )}
            </Droppable>
          </div>

          {/* Secciones */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Secciones del layout</h3>
            </div>

            {sectionsWithDisplaySettings.map((section) => {
              const { col1, col2 } = splitFieldsIntoColumns(section.fields || []);
              const relatedObjectDef = getObjectByApiName(section.relatedObject);
              const relatedFields = relatedObjectDef?.fields || [];

              return (
                <div
                  key={section.id}
                  className="border rounded-lg p-4 space-y-4 bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                      <input
                        className="border p-2 rounded"
                        placeholder="Nombre de sección"
                        value={section.showLabel === false ? "" : section.label}
                        disabled={section.showLabel === false}
                        onChange={(e) =>
                          updateSection(section.id, { label: e.target.value })
                        }
                      />

                      <select
                        className="border p-2 rounded"
                        value={section.type || "fields"}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          updateSection(section.id, {
                            type: nextType,
                            columns: nextType === "relatedList" ? 1 : section.columns || 2,
                            fields: nextType === "fields" ? section.fields || [] : [],
                            relatedObject:
                              nextType === "relatedList"
                                ? section.relatedObject || ""
                                : "",
                            relatedField:
                              nextType === "relatedList"
                                ? section.relatedField || ""
                                : "",
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

                      {section.type === "fields" ? (
                        <select
                          className="border p-2 rounded"
                          value={section.columns}
                          onChange={(e) =>
                            updateSection(section.id, {
                              columns: Number(e.target.value),
                            })
                          }
                        >
                          <option value={1}>1 columna</option>
                          <option value={2}>2 columnas</option>
                        </select>
                      ) : (
                        <input
                          className="border p-2 rounded"
                          placeholder="Campo relacionado (ej: customerId)"
                          value={section.relatedField || ""}
                          onChange={(e) =>
                            updateSection(section.id, {
                              relatedField: e.target.value,
                            })
                          }
                        />
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={section.showLabel !== false}
                        onChange={(e) =>
                          updateSection(section.id, {
                            showLabel: e.target.checked,
                            label: e.target.checked ? section.label || "" : "",
                          })
                        }
                      />
                      Mostrar titulo
                    </label>

                    <button
                      type="button"
                      onClick={() => deleteSection(section.id)}
                      className="bg-red-600 text-white px-3 py-2 rounded"
                    >
                      Eliminar
                    </button>
                  </div>

                  {section.type === "fields" ? (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addBlankBlock(section.id)}
                          className="bg-gray-200 px-3 py-2 rounded"
                        >
                          Agregar bloque vacío
                        </button>
                      </div>

                      {section.columns === 1 ? (
                        <div>
                          <h4 className="font-medium mb-2">Contenido</h4>
                          <Droppable droppableId={`${section.id}__col1`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-[120px] rounded-lg border p-3 space-y-2 ${
                                  snapshot.isDraggingOver
                                    ? "bg-blue-50"
                                    : "bg-gray-50"
                                }`}
                              >
                                {(section.fields || []).map((value, index) => (
                                  <Draggable
                                    key={value}
                                    draggableId={value}
                                    index={index}
                                  >
                                    {(providedDraggable, snapshotDraggable) =>
                                      renderItemCard(
                                        value,
                                        providedDraggable,
                                        snapshotDraggable
                                      )
                                    }
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                {(section.fields || []).length === 0 && (
                                  <p className="text-sm text-gray-500">
                                    Arrastra campos aquí
                                  </p>
                                )}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Columna 1</h4>
                            <Droppable droppableId={`${section.id}__col1`}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[120px] rounded-lg border p-3 space-y-2 ${
                                    snapshot.isDraggingOver
                                      ? "bg-blue-50"
                                      : "bg-gray-50"
                                  }`}
                                >
                                  {col1.map((item, index) => (
                                    <Draggable
                                      key={item.value}
                                      draggableId={item.value}
                                      index={index}
                                    >
                                      {(providedDraggable, snapshotDraggable) =>
                                        renderItemCard(
                                          item.value,
                                          providedDraggable,
                                          snapshotDraggable
                                        )
                                      }
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  {col1.length === 0 && (
                                    <p className="text-sm text-gray-500">
                                      Arrastra campos aquí
                                    </p>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Columna 2</h4>
                            <Droppable droppableId={`${section.id}__col2`}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[120px] rounded-lg border p-3 space-y-2 ${
                                    snapshot.isDraggingOver
                                      ? "bg-blue-50"
                                      : "bg-gray-50"
                                  }`}
                                >
                                  {col2.map((item, index) => (
                                    <Draggable
                                      key={item.value}
                                      draggableId={item.value}
                                      index={index}
                                    >
                                      {(providedDraggable, snapshotDraggable) =>
                                        renderItemCard(
                                          item.value,
                                          providedDraggable,
                                          snapshotDraggable
                                        )
                                      }
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  {col2.length === 0 && (
                                    <p className="text-sm text-gray-500">
                                      Arrastra campos aquí
                                    </p>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Objeto relacionado
                          </label>
                          <select
                            className="border p-2 rounded w-full"
                            value={section.relatedObject || ""}
                            onChange={(e) =>
                              updateSection(section.id, {
                                relatedObject: e.target.value,
                                relatedColumns: [],
                              })
                            }
                          >
                            <option value="">Seleccione</option>
                            {objects.map((obj) => (
                              <option key={obj.apiName} value={obj.apiName}>
                                {obj.name || obj.apiName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Campo del objeto relacionado
                          </label>
                          <input
                            className="border p-2 rounded w-full"
                            placeholder="Ej: customerId"
                            value={section.relatedField || ""}
                            onChange={(e) =>
                              updateSection(section.id, {
                                relatedField: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Columnas a mostrar
                        </label>
                        {section.relatedObject ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {relatedFields.map((field) => (
                              <label
                                key={field.apiName}
                                className="flex items-center gap-2 border rounded p-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={(section.relatedColumns || []).includes(
                                    field.apiName
                                  )}
                                  onChange={() =>
                                    toggleRelatedColumn(section.id, field.apiName)
                                  }
                                />
                                <span>
                                  {field.label} ({field.apiName})
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            Selecciona un objeto relacionado para elegir columnas.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      <div className="flex gap-3">
        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={handleSave}
          type="button"
        >
          Guardar layout
        </button>

        <button
          className="bg-gray-300 px-4 py-2 rounded"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default LayoutEditor;


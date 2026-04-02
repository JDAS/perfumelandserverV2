import { useMemo, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

function LayoutEditor({ layout, allFields, onSave, onCancel }) {
  const [localLayout, setLocalLayout] = useState(
    JSON.parse(JSON.stringify(layout))
  );

  const normalizeSections = (sections = []) =>
    sections.map((section, index) => ({
      id: section.id || `section_${index}_${section.apiName || section.label}`,
      label: section.label || "Nueva sección",
      columns: section.columns || 1,
      fields: section.fields || [],
    }));

  const [sections, setSections] = useState(
    normalizeSections(localLayout.sections || [])
  );

  const assignedFieldApiNames = useMemo(() => {
    return sections.flatMap((section) => section.fields);
  }, [sections]);

  const availableFields = useMemo(() => {
    return allFields.filter(
      (field) => !assignedFieldApiNames.includes(field.apiName)
    );
  }, [allFields, assignedFieldApiNames]);

  const getFieldByApiName = (apiName) =>
    allFields.find((field) => field.apiName === apiName);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `section_${Date.now()}`,
        label: "Nueva sección",
        columns: 2,
        fields: [],
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

  const removeFieldFromAllSections = (fieldApiName, sourceSections) => {
    return sourceSections.map((section) => ({
      ...section,
      fields: section.fields.filter((f) => f !== fieldApiName),
    }));
  };

  const reorder = (list, startIndex, endIndex) => {
    const result = [...list];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const sourceId = source.droppableId;
    const destinationId = destination.droppableId;

    if (sourceId === destinationId) {
      if (sourceId === "available") return;

      setSections((prev) =>
        prev.map((section) =>
          section.id === sourceId
            ? {
                ...section,
                fields: reorder(
                  section.fields,
                  source.index,
                  destination.index
                ),
              }
            : section
        )
      );
      return;
    }

    let updatedSections = removeFieldFromAllSections(draggableId, sections);

    if (destinationId !== "available") {
      updatedSections = updatedSections.map((section) => {
        if (section.id !== destinationId) return section;

        const newFields = [...section.fields];
        newFields.splice(destination.index, 0, draggableId);

        return {
          ...section,
          fields: newFields,
        };
      });
    }

    setSections(updatedSections);
  };

  const handleSave = () => {
    const cleanedLayout = {
      ...localLayout,
      sections: sections.map(({ id, ...section }) => ({
        ...section,
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

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campos disponibles */}
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
                      {(providedDraggable, snapshotDraggable) => (
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
                          </p>
                        </div>
                      )}
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
              <button
                type="button"
                onClick={addSection}
                className="bg-gray-200 px-4 py-2 rounded"
              >
                Agregar sección
              </button>
            </div>

            {sections.map((section) => (
              <div key={section.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                    <input
                      className="border p-2 rounded"
                      placeholder="Nombre de sección"
                      value={section.label}
                      onChange={(e) =>
                        updateSection(section.id, { label: e.target.value })
                      }
                    />

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
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteSection(section.id)}
                    className="bg-red-600 text-white px-3 py-2 rounded"
                  >
                    Eliminar
                  </button>
                </div>

                <Droppable droppableId={section.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] rounded-lg border p-3 space-y-2 ${
                        snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"
                      }`}
                    >
                      {section.fields.map((fieldApiName, index) => {
                        const field = getFieldByApiName(fieldApiName);
                        if (!field) return null;

                        return (
                          <Draggable
                            key={field.apiName}
                            draggableId={field.apiName}
                            index={index}
                          >
                            {(providedDraggable, snapshotDraggable) => (
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
                                </p>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {section.fields.length === 0 && (
                        <p className="text-sm text-gray-500">
                          Arrastra campos aquí
                        </p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
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
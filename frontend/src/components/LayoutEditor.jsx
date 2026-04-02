import { useState } from "react";

function LayoutEditor({ layout, allFields, onSave, onCancel }) {
  const [localLayout, setLocalLayout] = useState(
    JSON.parse(JSON.stringify(layout))
  );

  const addSection = () => {
    setLocalLayout((prev) => ({
      ...prev,
      sections: [
        ...(prev.sections || []),
        {
          label: "Nueva sección",
          columns: 2,
          fields: [],
        },
      ],
    }));
  };

  const updateSection = (index, changes) => {
    const updatedSections = [...(localLayout.sections || [])];
    updatedSections[index] = {
      ...updatedSections[index],
      ...changes,
    };

    setLocalLayout((prev) => ({
      ...prev,
      sections: updatedSections,
    }));
  };

  const deleteSection = (index) => {
    const updatedSections = [...(localLayout.sections || [])];
    updatedSections.splice(index, 1);

    setLocalLayout((prev) => ({
      ...prev,
      sections: updatedSections,
    }));
  };

  const toggleFieldInSection = (sectionIndex, fieldApiName) => {
    const section = localLayout.sections[sectionIndex];
    const exists = section.fields.includes(fieldApiName);

    const updatedFields = exists
      ? section.fields.filter((f) => f !== fieldApiName)
      : [...section.fields, fieldApiName];

    updateSection(sectionIndex, { fields: updatedFields });
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Editar layout</h2>
        <p className="text-sm text-gray-500">
          {localLayout.label} · {localLayout.apiName}
        </p>
      </div>

      {(localLayout.sections || []).map((section, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Sección {index + 1}</h3>
            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={() => deleteSection(index)}
              type="button"
            >
              Eliminar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="border p-2"
              placeholder="Label de sección"
              value={section.label}
              onChange={(e) =>
                updateSection(index, { label: e.target.value })
              }
            />

            <select
              className="border p-2"
              value={section.columns}
              onChange={(e) =>
                updateSection(index, { columns: Number(e.target.value) })
              }
            >
              <option value={1}>1 columna</option>
              <option value={2}>2 columnas</option>
            </select>
          </div>

          <div>
            <p className="font-medium mb-2">Campos</p>
            <div className="grid grid-cols-2 gap-2">
              {allFields.map((field) => (
                <label
                  key={field.apiName}
                  className="flex items-center gap-2 border rounded p-2"
                >
                  <input
                    type="checkbox"
                    checked={section.fields.includes(field.apiName)}
                    onChange={() =>
                      toggleFieldInSection(index, field.apiName)
                    }
                  />
                  <span>
                    {field.label}{" "}
                    <span className="text-gray-500 text-sm">
                      ({field.apiName})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <button
          className="bg-gray-200 px-4 py-2 rounded"
          onClick={addSection}
          type="button"
        >
          Agregar sección
        </button>

        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={() => onSave(localLayout)}
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
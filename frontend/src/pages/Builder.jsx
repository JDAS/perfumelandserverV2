import { useState } from "react";
import axios from "axios";

function Builder() {
  const [name, setName] = useState("");
  const [apiName, setApiName] = useState("");
  const [fields, setFields] = useState([]);

  const [field, setField] = useState({
    label: "",
    apiName: "",
    type: "text",
    required: false,
    options: [],
  });

  const normalizeApiName = (value) =>
    value.toLowerCase().trim().replace(/\s+/g, "_");

  const addField = () => {
    if (!field.label.trim()) {
      alert("El label del campo es obligatorio");
      return;
    }

    const finalApiName = field.apiName?.trim()
      ? normalizeApiName(field.apiName)
      : normalizeApiName(field.label);

    const newField = {
      label: field.label.trim(),
      apiName: finalApiName,
      type: field.type,
      required: field.required,
      options: field.type === "select" ? field.options || [] : [],
    };

    setFields((prev) => [...prev, newField]);
    setField({
      label: "",
      apiName: "",
      type: "text",
      required: false,
      options: [],
    });
  };

  const createObject = async () => {
    if (!name.trim()) {
      alert("El nombre del objeto es obligatorio");
      return;
    }

    const finalApiName = apiName.trim()
      ? normalizeApiName(apiName)
      : normalizeApiName(name);

    try {
      await axios.post("/api/custom-objects", {
        name: name.trim(),
        apiName: finalApiName,
        fields,
        layout: [
          {
            label: "principal",
            apiName: "principal",
            sections: [
              {
                label: "Detalles",
                columns: 2,
                fields:
                  fields.length > 0
                    ? fields.map((f) => f.apiName)
                    : ["name"],
              },
            ],
          },
        ],
      });

      alert("Objeto creado 🚀");
      setName("");
      setApiName("");
      setFields([]);
      setField({
        label: "",
        apiName: "",
        type: "text",
        required: false,
        options: [],
      });
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.error || "Error al crear el objeto"
      );
    }
  };

  return (
    <div className="p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Builder</h1>

      <input
        placeholder="Nombre"
        className="border p-2 w-full mb-3"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="API Name (ej: product)"
        className="border p-2 w-full mb-6"
        value={apiName}
        onChange={(e) => setApiName(e.target.value)}
      />

      <h2 className="font-bold mb-2">Campos</h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          placeholder="Label"
          className="border p-2"
          value={field.label}
          onChange={(e) =>
            setField({ ...field, label: e.target.value })
          }
        />

        <input
          placeholder="API Name"
          className="border p-2"
          value={field.apiName}
          onChange={(e) =>
            setField({ ...field, apiName: e.target.value })
          }
        />

        <select
          className="border p-2"
          value={field.type}
          onChange={(e) =>
            setField({ ...field, type: e.target.value, options: [] })
          }
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
          <option value="date">Date</option>
        </select>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) =>
              setField({ ...field, required: e.target.checked })
            }
          />
          <span className="ml-2">Required</span>
        </label>

        {field.type === "select" && (
          <input
            placeholder="Opciones separadas por coma"
            className="border p-2 col-span-2"
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

      <button
        onClick={addField}
        className="bg-gray-200 px-4 py-2 mb-6"
        type="button"
      >
        Agregar campo
      </button>

      <div className="mb-6">
        {fields.map((f, i) => (
          <div key={`${f.apiName}-${i}`} className="text-sm">
            {f.label} - {f.apiName} ({f.type})
          </div>
        ))}
      </div>

      <button
        onClick={createObject}
        className="bg-black text-white w-full py-2"
        type="button"
      >
        Crear Objeto
      </button>
    </div>
  );
}

export default Builder;
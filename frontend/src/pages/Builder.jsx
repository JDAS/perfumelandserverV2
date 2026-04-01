import { useState } from "react";
import axios from "axios";

function Builder() {
  const [name, setName] = useState("");
  const [apiName, setApiName] = useState("");
  const [fields, setFields] = useState([]);

  const [field, setField] = useState({
    label: "",
    name: "",
    type: "text",
    required: false,
  });

  const addField = () => {
    setFields([...fields, field]);
    setField({ label: "", name: "", type: "text", required: false });
  };

  const createObject = async () => {
    await axios.post("/api/custom-objects", {
      name,
      apiName,
      fields,
    });

    alert("Objeto creado 🚀");
    setName("");
    setApiName("");
    setFields([]);
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
          placeholder="Name"
          className="border p-2"
          value={field.name}
          onChange={(e) =>
            setField({ ...field, name: e.target.value })
          }
        />

        <select
          className="border p-2"
          value={field.type}
          onChange={(e) =>
            setField({ ...field, type: e.target.value })
          }
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
          <option value="date">Date</option>
        </select>
        {field.type === "select" && (
  <input
    placeholder="Opciones separadas por coma"
    className="border p-2 col-span-2"
    onChange={(e) =>
      setField({
        ...field,
        options: e.target.value.split(","),
      })
    }
  />
)}
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
      </div>

      <button
        onClick={addField}
        className="bg-gray-200 px-4 py-2 mb-6"
      >
        Agregar campo
      </button>

      <div className="mb-6">
        {fields.map((f, i) => (
          <div key={i} className="text-sm">
            {f.label} ({f.type})
          </div>
        ))}
      </div>

      <button
        onClick={createObject}
        className="bg-black text-white w-full py-2"
      >
        Crear Objeto
      </button>
    </div>
  );
}

export default Builder;
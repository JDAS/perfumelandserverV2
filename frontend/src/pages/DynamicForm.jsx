import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getObjects, createRecord } from "../services/customService";


function DynamicForm() {
  const { object } = useParams();

  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [layout, setLayout] = useState([]);

  useEffect(() => {
    loadObject();
  }, []);

  const loadObject = async () => {
    const objects = await getObjects();
    const current = objects.find((o) => o.apiName === object);

    if (current) {
        setLayout(current.layout || []);
      setFields(current.fields);
    }
  };

  const handleChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  for (let f of fields) {
    if (f.required && !formData[f.name]) {
      alert(`${f.label} es requerido`);
      return;
    }
  }

  await createRecord(object, formData);
  alert("Registro creado 🚀");
};

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        Nuevo {object}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {layout.map((section) => (
  <div key={section.section} className="mb-6">
    <h2 className="font-bold mb-2">
      {section.section}
    </h2>

    {section.fields.map((fieldName) => {
      const field = fields.find(f => f.name === fieldName);
      if (!field) return null;

      return (
        <div key={field.name} className="mb-3">
          <label>{field.label}</label>

           {field.type === "text" && (
              <input
                className="w-full border p-2"
                onChange={(e) =>
                  handleChange(field.name, e.target.value)
                }
              />
            )}

            {field.type === "number" && (
              <input
                type="number"
                className="w-full border p-2"
                onChange={(e) =>
                  handleChange(field.name, e.target.value)
                }
              />
            )}
            {field.type === "select" && (
                <select
                    className="w-full border p-2"
                    onChange={(e) =>
                    handleChange(field.name, e.target.value)
                    }
                >
                    <option value="">Seleccione</option>
                    {field.options?.map((opt, i) => (
                    <option key={i} value={opt}>
                        {opt}
                    </option>
                    ))}
                </select>
                )}
                {field.type === "date" && (
  <input
    type="date"
    className="w-full border p-2"
    onChange={(e) =>
      handleChange(field.name, e.target.value)
    }
  />
)}
        </div>
      );
    })}
  </div>
))}
        <button className="bg-black text-white w-full py-2">
          Guardar
        </button>
      </form>
    </div>
  );
}

export default DynamicForm;
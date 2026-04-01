import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getObjects, createRecord } from "../services/customService";

function DynamicForm() {
  const { object } = useParams();

  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadObject();
  }, []);

  const loadObject = async () => {
    const objects = await getObjects();
    const current = objects.find((o) => o.apiName === object);

    if (current) {
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
    await createRecord(object, formData);
    alert("Registro creado 🚀");
  };

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        Nuevo {object}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block mb-1">
              {field.label}
            </label>

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
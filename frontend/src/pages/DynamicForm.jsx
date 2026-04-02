import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getObjects, createRecord } from "../services/customService";

function DynamicForm() {
  const { object } = useParams();

  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [layout, setLayout] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadObject();
  }, [object]);

  const loadObject = async () => {
    try {
      const objects = await getObjects();
      const current = objects.find((o) => o.apiName === object);

      if (current) {
        setFields(current.fields || []);
        setLayout(current.layout || []);
      }
    } catch (error) {
      console.error("Error cargando objeto:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (apiName, value) => {
    setFormData((prev) => ({
      ...prev,
      [apiName]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const f of fields) {
      if (f.required && !formData[f.apiName]) {
        alert(`${f.label} es requerido`);
        return;
      }
    }

    try {
      await createRecord(object, formData);
      alert("Registro creado 🚀");
      setFormData({});
    } catch (error) {
      console.error("Error creando registro:", error);
      alert(
        error?.response?.data?.error || "Error al crear el registro"
      );
    }
  };

  const renderField = (field) => {
    const commonProps = {
      className: "w-full border p-2",
      value: formData[field.apiName] || "",
      onChange: (e) => handleChange(field.apiName, e.target.value),
    };

    if (field.type === "text") {
      return <input {...commonProps} type="text" />;
    }

    if (field.type === "number") {
      return <input {...commonProps} type="number" />;
    }

    if (field.type === "select") {
      return (
        <select {...commonProps}>
          <option value="">Seleccione</option>
          {field.options?.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "date") {
      return <input {...commonProps} type="date" />;
    }

    return <input {...commonProps} type="text" />;
  };

  if (loading) {
    return <div className="p-10">Cargando...</div>;
  }

  const activeLayout = layout?.[0];

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuevo {object}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeLayout?.sections?.length > 0 ? (
          activeLayout.sections.map((section) => (
            <div key={section.apiName || section.label} className="mb-6">
              <h2 className="font-bold mb-3 text-lg">{section.label}</h2>

              <div
                className={`grid gap-4 ${
                  section.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                }`}
              >
                {section.fields.map((fieldApiName) => {
                  const field = fields.find((f) => f.apiName === fieldApiName);
                  if (!field) return null;

                  return (
                    <div key={field.apiName} className="mb-3">
                      <label className="block mb-1 font-medium">
                        {field.label}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {renderField(field)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="grid gap-4">
            {fields.map((field) => (
              <div key={field.apiName} className="mb-3">
                <label className="block mb-1 font-medium">
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
        )}

        <button type="submit" className="bg-black text-white w-full py-2 rounded">
          Guardar
        </button>
      </form>
    </div>
  );
}

export default DynamicForm;
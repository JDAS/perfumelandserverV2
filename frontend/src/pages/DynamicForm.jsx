import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  getObjects,
  createRecord,
  getRecordById,
  updateRecord,
} from "../services/customService";

function DynamicForm() {
  const { object, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [layout, setLayout] = useState([]);
  const [loading, setLoading] = useState(true);

  const isEditMode = !!id;
  const returnTab = searchParams.get("tab") || object;

  useEffect(() => {
    loadObject();
  }, [object, id]);

  const loadObject = async () => {
    try {
      setLoading(true);

      const objects = await getObjects();
      const current = objects.find((o) => o.apiName === object);

      if (current) {
        setFields(current.fields || []);
        setLayout(current.layout || []);
      }

      if (id && current) {
        const record = await getRecordById(object, id);

        const allowedFieldNames = (current.fields || []).map(
          (f) => f.apiName
        );

        const cleanRecord = Object.fromEntries(
          Object.entries(record || {}).filter(([key]) =>
            allowedFieldNames.includes(key)
          )
        );

        setFormData(cleanRecord);
      }
    } catch (error) {
      console.error("Error cargando objeto o registro:", error);
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
      const allowedFieldNames = fields.map((f) => f.apiName);

      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([key]) =>
          allowedFieldNames.includes(key)
        )
      );

      if (isEditMode) {
        await updateRecord(object, id, cleanFormData);
        alert("Registro actualizado 🚀");
      } else {
        await createRecord(object, cleanFormData);
        alert("Registro creado 🚀");
      }

      navigate(`/admin?tab=${returnTab}`);
    } catch (error) {
      console.error("Error guardando registro:", error);
      alert(
        error?.response?.data?.error || "Error al guardar el registro"
      );
    }
  };

  const isBlankBlock = (value) =>
    typeof value === "string" && value.startsWith("__blank__");

  const splitFieldsIntoColumns = (fieldList = []) => {
    const col1 = [];
    const col2 = [];

    fieldList.forEach((item, index) => {
      if (index % 2 === 0) {
        col1.push(item);
      } else {
        col2.push(item);
      }
    });

    return { col1, col2 };
  };

  const renderField = (field) => {
    const commonProps = {
      className: "w-full border p-2 rounded",
      value: formData[field.apiName] || "",
      onChange: (e) => handleChange(field.apiName, e.target.value),
    };

    if (field.type === "text") {
      return <input {...commonProps} type="text" />;
    }

    if (field.type === "number") {
      return <input {...commonProps} type="number" />;
    }

    if (field.type === "date") {
      return <input {...commonProps} type="date" />;
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

    return <input {...commonProps} type="text" />;
  };

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return (
        <div
          key={`${item}-${index}`}
          className="h-[72px] rounded border-2 border-dashed border-gray-200 bg-gray-50"
        />
      );
    }

    const field = fields.find((f) => f.apiName === item);
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
  };

  if (loading) {
    return <div className="p-10">Cargando...</div>;
  }

  const activeLayout = layout?.[0];

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isEditMode ? `Editar ${object}` : `Nuevo ${object}`}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeLayout?.sections?.length > 0 ? (
          activeLayout.sections.map((section, idx) => {
            const sectionFields = section.fields || [];
            const { col1, col2 } = splitFieldsIntoColumns(sectionFields);

            return (
              <div
                key={`${section.label}-${idx}`}
                className="bg-white rounded-xl shadow p-6"
              >
                <h2 className="font-bold mb-4 text-lg">{section.label}</h2>

                {section.columns === 2 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      {col1.map((item, index) =>
                        renderFieldOrBlank(item, index)
                      )}
                    </div>

                    <div>
                      {col2.map((item, index) =>
                        renderFieldOrBlank(item, index)
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {sectionFields.map((item, index) =>
                      renderFieldOrBlank(item, index)
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl shadow p-6">
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

        <button
          type="submit"
          className="bg-black text-white w-full py-3 rounded"
        >
          {isEditMode ? "Actualizar" : "Guardar"}
        </button>
      </form>
    </div>
  );
}

export default DynamicForm;
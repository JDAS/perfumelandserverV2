import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createRecord, getRecordById, updateRecord } from "../services/customService";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { getBackToListSearch, getFormFields, isBlankBlock, splitFieldsIntoColumns } from "../engine/metadataEngine";
import { renderFieldInput } from "../components/fields/FieldRegistry";

function DynamicForm() {
  const { object, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getObjectByApiNameFromCache } = useObjectMetadata();

  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  const objectDef = getObjectByApiNameFromCache(object);
  const fields = useMemo(() => getFormFields(objectDef), [objectDef]);
  const activeLayout = objectDef?.layout?.[0];
  const isEditMode = Boolean(id);
  const backToListQuery = getBackToListSearch(searchParams, object);

  useEffect(() => {
    async function loadRecord() {
      if (!objectDef) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const initialState = Object.fromEntries(fields.map((field) => [field.apiName, field.type === "boolean" ? false : ""]));

        if (isEditMode) {
          const record = await getRecordById(object, id);
          const allowedFieldNames = new Set(fields.map((field) => field.apiName));
          const cleanRecord = Object.fromEntries(Object.entries(record || {}).filter(([key]) => allowedFieldNames.has(key)));
          setFormData({ ...initialState, ...cleanRecord });
        } else {
          setFormData(initialState);
        }
      } catch (error) {
        console.error("Error cargando objeto o registro:", error);
      } finally {
        setLoading(false);
      }
    }

    loadRecord();
  }, [objectDef, fields, object, id, isEditMode]);

  const handleChange = (apiName, value) => {
    setFormData((prev) => ({ ...prev, [apiName]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const field of fields) {
      if (field.required && (formData[field.apiName] === undefined || formData[field.apiName] === null || formData[field.apiName] === "")) {
        alert(`${field.label} es requerido`);
        return;
      }
    }

    try {
      const payload = Object.fromEntries(fields.map((field) => [field.apiName, formData[field.apiName]]));
      if (isEditMode) {
        await updateRecord(object, id, payload);
        alert("Registro actualizado 🚀");
      } else {
        await createRecord(object, payload);
        alert("Registro creado 🚀");
      }
      navigate(`/admin?${backToListQuery}`);
    } catch (error) {
      console.error("Error guardando registro:", error);
      alert(error?.response?.data?.error || "Error al guardar el registro");
    }
  };

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return <div key={`${item}-${index}`} className="h-[72px] rounded border-2 border-dashed border-gray-200 bg-gray-50" />;
    }

    const field = fields.find((currentField) => currentField.apiName === item);
    if (!field) return null;

    return (
      <div key={field.apiName} className="mb-3">
        {field.type !== "boolean" && (
          <label className="block mb-1 font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {renderFieldInput(field, formData[field.apiName], (value) => handleChange(field.apiName, value))}
      </div>
    );
  };

  if (loading) return <div className="p-10">Cargando...</div>;
  if (!objectDef) return <div className="p-10">Objeto no encontrado.</div>;

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEditMode ? `Editar ${objectDef.name}` : `Nuevo ${objectDef.name}`}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeLayout?.sections?.length > 0 ? (
          activeLayout.sections.map((section, idx) => {
            const sectionFields = section.fields || [];
            const { col1, col2 } = splitFieldsIntoColumns(sectionFields);

            return (
              <div key={`${section.label}-${idx}`} className="bg-white rounded-xl shadow p-6">
                <h2 className="font-bold mb-4 text-lg">{section.label}</h2>
                {section.columns === 2 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>{col1.map((item, index) => renderFieldOrBlank(item, index))}</div>
                    <div>{col2.map((item, index) => renderFieldOrBlank(item, index))}</div>
                  </div>
                ) : (
                  <div>{sectionFields.map((item, index) => renderFieldOrBlank(item, index))}</div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl shadow p-6">
            {fields.map((field, index) => renderFieldOrBlank(field.apiName, index))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(`/admin?${backToListQuery}`)} className="px-4 py-2 rounded bg-gray-200">Cancelar</button>
          <button type="submit" className="px-4 py-2 rounded bg-black text-white">Guardar</button>
        </div>
      </form>
    </div>
  );
}

export default DynamicForm;

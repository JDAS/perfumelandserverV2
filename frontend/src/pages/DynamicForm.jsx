import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createRecord,
  getRecordById,
  updateRecord,
} from "../services/customService";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  getBackToListSearch,
  getFormFields,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../engine/metadataEngine";
import { renderFieldInput } from "../components/fields/FieldRegistry";
import { useToast } from "../components/ui/ToastContext";

function formatValueForInput(field, value) {
  if (value === undefined || value === null || value === "") return "";

  if (field.type === "boolean") {
    return Boolean(value);
  }

  if (field.type === "date") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  if (field.type === "datetime") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  return value;
}

function resolveDateDefaultValue(defaultValue) {
  if (
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue) &&
    defaultValue.mode === "relative"
  ) {
    const today = new Date();
    const resolved = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + (Number(defaultValue.offsetDays) || 0)
    );

    return resolved.toISOString().slice(0, 10);
  }

  if (
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue)
  ) {
    return defaultValue.value || "";
  }

  return defaultValue;
}

function getFieldDefaultValue(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== "") {
    const defaultValue =
      field.type === "date"
        ? resolveDateDefaultValue(field.defaultValue)
        : field.defaultValue;

    return formatValueForInput(field, defaultValue);
  }

  if (field.type === "boolean") {
    return false;
  }

  return "";
}

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
  const returnTo = searchParams.get("returnTo");
  const { addToast } = useToast();

  const navigateBack = () => {
    if (returnTo === "detail" && isEditMode) {
      navigate(`/admin/${object}/${id}/view?${backToListQuery}`);
      return;
    }

    navigate(`/admin?${backToListQuery}`);
  };

  useEffect(() => {
    async function loadRecord() {
      if (!objectDef) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const initialState = Object.fromEntries(
          fields.map((field) => {
            return [field.apiName, getFieldDefaultValue(field)];
          })
        );

        if (isEditMode) {
          const record = await getRecordById(object, id);

          const cleanRecord = Object.fromEntries(
            fields.map((field) => [
              field.apiName,
              formatValueForInput(field, record?.[field.apiName]),
            ])
          );

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
    setFormData((prev) => ({
      ...prev,
      [apiName]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const field of fields) {
      const value = formData[field.apiName];

      if (
        field.required &&
        (value === undefined || value === null || value === "")
      ) {
        addToast(`${field.label} es requerido`,"warning");
        return;
      }
    }

    try {
      const payload = Object.fromEntries(
        fields
          .filter((field) => !["formula", "rollup"].includes(field.type))
          .map((field) => [field.apiName, formData[field.apiName]])
      );

      if (isEditMode) {
        await updateRecord(object, id, payload);
        addToast("Registro actualizado 🚀","success");
      } else {
        await createRecord(object, payload);
        addToast("Registro creado 🚀","success");
      }

      navigateBack();
    } catch (error) {
      console.error("Error guardando registro:", error);
      addToast(error?.response?.data?.error || "Error al guardar el registro","error");
    }
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

    const field = fields.find((currentField) => currentField.apiName === item);
    if (!field) return null;

    return (
      <div key={field.apiName} className="mb-3">
        {field.type !== "boolean" && (
          <label className="block mb-1 font-medium">
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
            {["formula", "rollup"].includes(field.type) && (
              <span className="ml-2 text-xs text-blue-500">(Calculado)</span>
            )}
          </label>
        )}

        {renderFieldInput(
          field,
          formData[field.apiName],
          (value) => handleChange(field.apiName, value),
          {
            objectDef,
            formData,
            setFormData,
          }
        )}
      </div>
    );
  };

  if (loading) return <div className="p-10">Cargando...</div>;
  if (!objectDef) return <div className="p-10">Objeto no encontrado.</div>;

  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );

  return (
    <div className="mx-auto max-w-4xl p-10">
      <h1 className="mb-6 text-2xl font-bold">
        {isEditMode ? `Editar ${objectDef.name}` : `Nuevo ${objectDef.name}`}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {fieldSections.length > 0 ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <div className="space-y-8">
              {fieldSections.map((section, idx) => {
                const sectionFields = section.fields || [];
                const { col1, col2 } = splitFieldsIntoColumns(sectionFields);
                const hasLabel = Boolean(String(section.label || "").trim());

                return (
                  <div
                    key={`${section.apiName || "section"}-${idx}`}
                    className={idx > 0 ? "border-t pt-6" : ""}
                  >
                    {hasLabel && (
                      <h2 className="mb-4 text-lg font-bold">{section.label}</h2>
                    )}

                    {section.columns === 2 ? (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                          {col1.map((item, index) => renderFieldOrBlank(item, index))}
                        </div>
                        <div>
                          {col2.map((item, index) => renderFieldOrBlank(item, index))}
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
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-6 shadow">
            {fields.map((field, index) => renderFieldOrBlank(field.apiName, index))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={navigateBack}
            className="rounded bg-gray-200 px-4 py-2"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-white"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

export default DynamicForm;

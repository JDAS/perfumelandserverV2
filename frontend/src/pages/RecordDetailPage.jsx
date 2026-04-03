import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import {
  getObjects,
  getRecordById,
} from "../services/customService";

function RecordDetailPage() {
  const { object, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [objectDef, setObjectDef] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const returnTab = searchParams.get("tab") || object;

  useEffect(() => {
    loadData();
  }, [object, id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const objects = await getObjects();
      const current = objects.find((o) => o.apiName === object);

      if (!current) {
        setObjectDef(null);
        setRecord(null);
        return;
      }

      setObjectDef(current);

      const recordData = await getRecordById(object, id);
      setRecord(recordData);
    } catch (error) {
      console.error("Error cargando detalle del registro:", error);
      setObjectDef(null);
      setRecord(null);
    } finally {
      setLoading(false);
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

  const getFieldByApiName = (apiName) =>
    (objectDef?.fields || []).find((f) => f.apiName === apiName);

  const formatValue = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return "-";
    }

    if (field?.type === "date") {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }

    return String(value);
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

    const field = getFieldByApiName(item);
    if (!field) return null;

    return (
      <div key={field.apiName} className="mb-4">
        <label className="block mb-1 text-sm font-medium text-gray-600">
          {field.label}
        </label>
        <div className="w-full rounded border bg-gray-50 p-3 min-h-[46px]">
          {formatValue(field, record?.[field.apiName])}
        </div>
      </div>
    );
  };

  const handleBack = () => {
    navigate(`/admin?tab=${returnTab}`);
  };

  if (loading) {
    return <div className="p-10">Cargando...</div>;
  }

  if (!objectDef || !record) {
    return (
      <div className="p-10">
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold mb-3">Registro no encontrado</h1>
          <button
            onClick={handleBack}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const activeLayout = objectDef.layout?.[0];

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            {objectDef.name} / Detalle de registro
          </p>
          <h1 className="text-3xl font-bold">{objectDef.name}</h1>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="bg-gray-200 text-black px-4 py-2 rounded"
          >
            Volver
          </button>

          <Link
            to={`/admin/${object}/${id}?tab=${returnTab}`}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Editar
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">ID:</span> {record._id}
          </div>
          <div>
            <span className="font-medium">Creado:</span>{" "}
            {record.createdAt
              ? new Date(record.createdAt).toLocaleString()
              : "-"}
          </div>
          <div>
            <span className="font-medium">Actualizado:</span>{" "}
            {record.updatedAt
              ? new Date(record.updatedAt).toLocaleString()
              : "-"}
          </div>
        </div>
      </div>

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
          {(objectDef.fields || []).map((field) => (
            <div key={field.apiName} className="mb-4">
              <label className="block mb-1 text-sm font-medium text-gray-600">
                {field.label}
              </label>
              <div className="w-full rounded border bg-gray-50 p-3 min-h-[46px]">
                {formatValue(field, record?.[field.apiName])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordDetailPage;
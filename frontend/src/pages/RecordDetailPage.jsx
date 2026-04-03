import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { getRecordById } from "../services/customService";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getBackToListSearch,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../engine/metadataEngine";

function RecordDetailPage() {
  const { object, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getObjectByApiNameFromCache } = useObjectMetadata();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const objectDef = getObjectByApiNameFromCache(object);
  const backToListQuery = getBackToListSearch(searchParams, object);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const recordData = await getRecordById(object, id);
        setRecord(recordData);
      } catch (error) {
        console.error("Error cargando detalle del registro:", error);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [object, id]);

  const getFieldByApiName = (apiName) =>
    (objectDef?.fields || []).find((field) => field.apiName === apiName);

  const renderFieldValue = (field) => {
    return formatFieldValue(field, record?.[field.apiName], record);
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
    if (!field || field.visibleInDetail === false) return null;

    return (
      <div key={field.apiName} className="mb-4">
        <label className="block mb-1 text-sm font-medium text-gray-600">
          {field.label}
        </label>
        <div className="w-full rounded border bg-gray-50 p-3 min-h-[46px]">
          {renderFieldValue(field)}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-10">Cargando...</div>;

  if (!objectDef || !record) {
    return (
      <div className="p-10">
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold mb-3">Registro no encontrado</h1>
          <button
            onClick={() => navigate(`/admin?${backToListQuery}`)}
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
            onClick={() => navigate(`/admin?${backToListQuery}`)}
            className="bg-gray-200 text-black px-4 py-2 rounded"
          >
            Volver
          </button>

          <Link
            to={`/admin/${objectDef.apiName}/${record._id}?${backToListQuery}`}
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
            {record.createdAt ? new Date(record.createdAt).toLocaleString() : "-"}
          </div>
          <div>
            <span className="font-medium">Actualizado:</span>{" "}
            {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "-"}
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
                  <div>{col1.map((item, index) => renderFieldOrBlank(item, index))}</div>
                  <div>{col2.map((item, index) => renderFieldOrBlank(item, index))}</div>
                </div>
              ) : (
                <div>
                  {sectionFields.map((item, index) => renderFieldOrBlank(item, index))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="bg-white rounded-xl shadow p-6">
          {(objectDef.fields || [])
            .filter((field) => field.visibleInDetail !== false)
            .map((field) => (
              <div key={field.apiName} className="mb-4">
                <label className="block mb-1 text-sm font-medium text-gray-600">
                  {field.label}
                </label>
                <div className="w-full rounded border bg-gray-50 p-3 min-h-[46px]">
                  {renderFieldValue(field)}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default RecordDetailPage;
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRelatedRecords } from "../services/customService";
import { formatFieldValue } from "../engine/metadataEngine";
import { useObjectMetadata } from "../context/ObjectMetadataContext";

function RelatedListSection({ parentObject, parentId, section }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const relatedObjectDef = getObjectByApiNameFromCache(section.relatedObject);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getRelatedRecords(
          parentObject,
          parentId,
          section.relatedObject,
          section.relatedField
        );
        setRecords(data.records || []);
      } catch (error) {
        console.error("Error cargando related list:", error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    }

    if (section.relatedObject && section.relatedField) {
      load();
    }
  }, [parentObject, parentId, section.relatedObject, section.relatedField]);

  const columns = (section.relatedColumns || [])
    .map((apiName) =>
      (relatedObjectDef?.fields || []).find((field) => field.apiName === apiName)
    )
    .filter(Boolean);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-bold mb-4 text-lg">{section.label}</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No hay registros relacionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                {columns.map((field) => (
                  <th key={field.apiName} className="p-3 border-b">
                    {field.label}
                  </th>
                ))}
                <th className="p-3 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id} className="hover:bg-gray-50">
                  {columns.map((field) => (
                    <td key={field.apiName} className="p-3 border-b">
                      {formatFieldValue(field, record[field.apiName], record)}
                    </td>
                  ))}
                  <td className="p-3 border-b">
                    <Link
                      to={`/admin/${section.relatedObject}/${record._id}/view?tab=${section.relatedObject}`}
                      className="px-3 py-1 bg-blue-600 text-white rounded"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RelatedListSection;
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getRelatedRecords } from "../services/customService";
import { formatFieldValue } from "../engine/metadataEngine";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import AttachmentRelatedListSection from "./AttachmentRelatedListSection";

function RelatedListSection({ parentObject, parentId, section }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const [searchParams] = useSearchParams();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const relatedObjectDef = getObjectByApiNameFromCache(section.relatedObject);

  if (section.relatedObject === "attachments") {
    return (
      <AttachmentRelatedListSection
        parentObject={parentObject}
        parentId={parentId}
        section={section}
      />
    );
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getRelatedRecords(
          parentObject,
          parentId,
          section.relatedObject,
          section.relatedField,
          {
            sortField: section.sortField || "",
            sortOrder: section.sortOrder || "desc",
          }
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
  }, [
    parentObject,
    parentId,
    section.relatedObject,
    section.relatedField,
    section.sortField,
    section.sortOrder,
  ]);

  const columns = useMemo(() => {
    return (section.relatedColumns || [])
      .map((apiName) =>
        (relatedObjectDef?.fields || []).find((field) => field.apiName === apiName)
      )
      .filter(Boolean);
  }, [section.relatedColumns, relatedObjectDef]);

  const detailQuery = new URLSearchParams(searchParams);
  if (!detailQuery.get("tab")) {
    detailQuery.set("tab", section.relatedObject);
  }

  const createQuery = new URLSearchParams(searchParams);
  createQuery.set("tab", section.relatedObject);
  createQuery.set(`prefill_${section.relatedField}`, parentId);
  createQuery.set("returnTo", "detail");
  createQuery.set("returnObject", parentObject);
  createQuery.set("returnId", parentId);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-bold text-lg">{section.label}</h2>
        <Link
          to={`/admin/${section.relatedObject}/new?${createQuery.toString()}`}
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          Nuevo relacionado
        </Link>
      </div>

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
                <th className="p-3 border-b">Creado</th>
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

                  <td className="p-3 border-b text-sm text-gray-500">
                    {record.createdAt
                      ? new Date(record.createdAt).toLocaleString()
                      : "-"}
                  </td>

                  <td className="p-3 border-b">
                    <Link
                      to={`/admin/${section.relatedObject}/${record._id}/view?${detailQuery.toString()}`}
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

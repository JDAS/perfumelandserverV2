import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteRecord, getRelatedRecords } from "../services/customService";
import { formatFieldValue, getLookupDisplayData } from "../engine/metadataEngine";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import AttachmentRelatedListSection from "./AttachmentRelatedListSection";
import { useToast } from "./ui/ToastContext";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 10v6M14 10v6" />
    </svg>
  );
}

function IconButton({
  as: Component = "button",
  label,
  className = "",
  children,
  ...props
}) {
  return (
    <Component
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {children}
    </Component>
  );
}

function RelatedListSection({ parentObject, parentId, section }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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

  const loadRecords = useCallback(async () => {
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
  }, [
    parentObject,
    parentId,
    section.relatedObject,
    section.relatedField,
    section.sortField,
    section.sortOrder,
  ]);

  useEffect(() => {
    if (section.relatedObject && section.relatedField) {
      loadRecords();
    }
  }, [
    loadRecords,
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

  const handleDelete = async (recordId) => {
    if (!recordId) return;
    if (!window.confirm("¿Eliminar este registro relacionado?")) return;

    try {
      setDeletingId(recordId);
      await deleteRecord(section.relatedObject, recordId);
      addToast("Registro relacionado eliminado", "success");
      await loadRecords();
    } catch (error) {
      console.error("Error eliminando related record:", error);
      addToast(
        error?.response?.data?.error || "No se pudo eliminar el registro relacionado",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const renderCellValue = (field, record) => {
    if (field?.type === "lookup") {
      const lookup = getLookupDisplayData(field, record?.[field.apiName], record);
      if (lookup.isLinkable) {
        return (
          <Link
            to={`/admin/${lookup.objectApi}/${lookup.recordId}/view?tab=${lookup.objectApi}`}
            className="font-medium text-blue-600 underline-offset-2 hover:underline"
          >
            {lookup.label}
          </Link>
        );
      }
    }

    return formatFieldValue(field, record[field.apiName], record);
  };

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
                      {renderCellValue(field, record)}
                    </td>
                  ))}

                  <td className="p-3 border-b text-sm text-gray-500">
                    {record.createdAt
                      ? new Date(record.createdAt).toLocaleString()
                      : "-"}
                  </td>

                  <td className="p-3 border-b">
                    <div className="flex flex-wrap gap-2">
                      <IconButton
                        as={Link}
                        to={`/admin/${section.relatedObject}/${record._id}/view?${detailQuery.toString()}`}
                        label="Ver"
                        className="bg-blue-600"
                      >
                        <EyeIcon />
                      </IconButton>
                      <IconButton
                        type="button"
                        onClick={() => handleDelete(record._id)}
                        disabled={deletingId === record._id}
                        label={
                          deletingId === record._id
                            ? "Eliminando..."
                            : "Eliminar"
                        }
                        className="bg-red-600"
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
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

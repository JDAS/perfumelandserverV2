import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createRecord,
  deleteRecord,
  getRecords,
  uploadAttachment,
} from "../services/customService";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { formatFieldValue } from "../engine/metadataEngine";
import { useToast } from "./ui/ToastContext";

function formatFileSize(size) {
  const numericSize = Number(size);
  if (!Number.isFinite(numericSize) || numericSize <= 0) return "-";
  if (numericSize < 1024) return `${numericSize} B`;
  if (numericSize < 1024 * 1024) return `${(numericSize / 1024).toFixed(1)} KB`;
  return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
}

function stripExtension(fileName = "") {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) return fileName;
  return fileName.slice(0, lastDot);
}

function AttachmentRelatedListSection({ parentObject, parentId, section }) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    fileName: "",
    mimeType: "",
    size: "",
  });

  const relatedObjectDef = getObjectByApiNameFromCache(section.relatedObject);

  const fieldMap = useMemo(() => {
    const fields = relatedObjectDef?.fields || [];
    const pick = (...apiNames) =>
      apiNames.find((apiName) => fields.some((field) => field.apiName === apiName)) || "";

    return {
      name: pick("name"),
      fileName: pick("file_name", "filename"),
      fileUrl: pick("file_url", "url"),
      mimeType: pick("mimetype", "mime_type"),
      size: pick("size"),
      linkedObject: pick("linked_object"),
      linkedRecordId: pick("linkedrecordid", "linked_record_id"),
      uploadedAt: pick("uploadedat", "uploaded_at"),
      isActive: pick("isactive", "is_active"),
    };
  }, [relatedObjectDef]);

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

  const loadAttachments = useCallback(async () => {
    if (!fieldMap.linkedObject || !fieldMap.linkedRecordId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getRecords(section.relatedObject, {
        page: 1,
        limit: 100,
        sortBy: section.sortField || fieldMap.uploadedAt || "createdAt",
        sortOrder: section.sortOrder || "desc",
        filters: JSON.stringify([
          {
            field: fieldMap.linkedObject,
            operator: "eq",
            value: parentObject,
          },
          {
            field: fieldMap.linkedRecordId,
            operator: "eq",
            value: parentId,
          },
        ]),
      });

      setRecords(data.records || []);
    } catch (error) {
      console.error("Error cargando adjuntos:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [
    fieldMap.linkedObject,
    fieldMap.linkedRecordId,
    fieldMap.uploadedAt,
    parentId,
    parentObject,
    section.relatedObject,
    section.sortField,
    section.sortOrder,
  ]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);

    if (!file) {
      setDraft({
        name: "",
        fileName: "",
        mimeType: "",
        size: "",
      });
      return;
    }

    setDraft({
      name: stripExtension(file.name),
      fileName: file.name,
      mimeType: file.type || "",
      size: file.size || "",
    });
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      addToast("Selecciona un archivo para subir.", "warning");
      return;
    }

    if (!fieldMap.fileUrl || !fieldMap.linkedObject || !fieldMap.linkedRecordId) {
      addToast("La metadata de attachments no tiene los campos esperados.", "error");
      return;
    }

    try {
      setUploading(true);
      const uploaded = await uploadAttachment(selectedFile);

      const payload = {
        [fieldMap.fileUrl]: uploaded.url,
        [fieldMap.linkedObject]: parentObject,
        [fieldMap.linkedRecordId]: parentId,
      };

      if (fieldMap.name) payload[fieldMap.name] = draft.name || stripExtension(selectedFile.name);
      if (fieldMap.fileName) payload[fieldMap.fileName] = draft.fileName || selectedFile.name;
      if (fieldMap.mimeType) payload[fieldMap.mimeType] = draft.mimeType || uploaded.mimeType || "";
      if (fieldMap.size) payload[fieldMap.size] = Number(draft.size || uploaded.size || 0);
      if (fieldMap.isActive) payload[fieldMap.isActive] = true;

      await createRecord(section.relatedObject, payload);

      addToast("Adjunto subido correctamente.", "success");
      setSelectedFile(null);
      setDraft({
        name: "",
        fileName: "",
        mimeType: "",
        size: "",
      });
      await loadAttachments();
    } catch (error) {
      console.error("Error subiendo adjunto:", error);
      addToast(
        error?.response?.data?.error || "No se pudo subir el adjunto.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (record) => {
    const confirmed = window.confirm(
      `¿Eliminar el adjunto "${record[fieldMap.name] || record[fieldMap.fileName] || "sin nombre"}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(String(record._id));
      await deleteRecord(section.relatedObject, record._id);
      addToast("Adjunto eliminado correctamente.", "success");
      await loadAttachments();
    } catch (error) {
      console.error("Error eliminando adjunto:", error);
      addToast(
        error?.response?.data?.error || "No se pudo eliminar el adjunto.",
        "error"
      );
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="font-bold text-lg">{section.label || "Adjuntos"}</h2>
        <span className="text-sm text-gray-500">
          {records.length} archivo{records.length === 1 ? "" : "s"}
        </span>
      </div>

      <form
        onSubmit={handleUpload}
        className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4"
      >
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Archivo
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="block w-full rounded border bg-white p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded border bg-white p-2"
              placeholder="Nombre visible"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Metadata
            </label>
            <div className="rounded border bg-white px-3 py-2 text-sm text-gray-600">
              {selectedFile ? (
                <>
                  {draft.mimeType || "Archivo"} · {formatFileSize(draft.size)}
                </>
              ) : (
                "Se autocompleta al elegir un archivo"
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {uploading ? "Subiendo..." : "Subir"}
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Se completan automaticamente el archivo, tipo MIME, tamano y la relacion
          con este registro.
        </p>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando adjuntos...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No hay adjuntos para este registro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                {columns.map((field) => (
                  <th key={field.apiName} className="border-b p-3">
                    {field.label}
                  </th>
                ))}
                <th className="border-b p-3">Vista previa</th>
                <th className="border-b p-3">Abrir</th>
                <th className="border-b p-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => {
                const fileUrl = fieldMap.fileUrl ? record[fieldMap.fileUrl] : "";
                const mimeType =
                  (fieldMap.mimeType && record[fieldMap.mimeType]) || "";
                const isImage = String(mimeType).startsWith("image/");

                return (
                  <tr key={record._id} className="hover:bg-gray-50">
                    {columns.map((field) => (
                      <td key={field.apiName} className="border-b p-3">
                        {formatFieldValue(field, record[field.apiName], record)}
                      </td>
                    ))}

                    <td className="border-b p-3">
                      {fileUrl && isImage ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <img
                            src={fileUrl}
                            alt={record[fieldMap.name] || record[fieldMap.fileName] || "Adjunto"}
                            className="h-16 w-16 rounded object-cover ring-1 ring-gray-200"
                          />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">Sin preview</span>
                      )}
                    </td>

                    <td className="border-b p-3">
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                        >
                          {isImage ? "Ver imagen" : "Abrir archivo"}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">Sin URL</span>
                      )}
                    </td>

                    <td className="border-b p-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/${section.relatedObject}/${record._id}/view?${detailQuery.toString()}`}
                          className="rounded bg-blue-600 px-3 py-1 text-white"
                        >
                          Ver
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          disabled={deletingId === String(record._id)}
                          className="rounded bg-red-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-red-300"
                        >
                          {deletingId === String(record._id) ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AttachmentRelatedListSection;

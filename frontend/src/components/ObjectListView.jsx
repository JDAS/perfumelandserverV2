import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteRecord, getRecords } from "../services/customService";
import { buildListQuery, buildRecordListRequest } from "../engine/listEngine";
import { formatFieldValue, getBackToListSearch } from "../engine/metadataEngine";
import Pagination from "./ui/Pagination";

function ObjectListView({ objectDef }) {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const listState = useMemo(
    () => buildListQuery({ searchParams, objectDef }),
    [searchParams, objectDef]
  );

  const backToListQuery = getBackToListSearch(searchParams, objectDef.apiName);

  useEffect(() => {
    setSearchInput(listState.search || "");
  }, [listState.search]);

  const loadRecords = useCallback(async () => {
    if (!objectDef?.apiName) return;

    try {
      setLoading(true);

      const data = await getRecords(
        objectDef.apiName,
        buildRecordListRequest({ objectDef, listState })
      );

      setRecords(data.records || []);

      setPagination(
        data.pagination || {
          page: data.page || 1,
          pages: data.pages || 1,
          total: data.total || 0,
          limit: data.limit || listState.limit || 10,
        }
      );
    } catch (error) {
      console.error(error);
      setRecords([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [objectDef, listState]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const updateParams = (changes = {}) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    next.set("tab", objectDef.apiName);
    setSearchParams(next);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro?")) return;

    try {
      await deleteRecord(objectDef.apiName, id);
      await loadRecords();
    } catch (error) {
      console.error(error);
      window.alert(error?.response?.data?.error || "Error eliminando el registro");
    }
  };

  const handleSort = (fieldApiName) => {
    const sameField = listState.sortBy === fieldApiName;

    updateParams({
      sortBy: fieldApiName,
      sortOrder: sameField && listState.sortOrder === "asc" ? "desc" : "asc",
      page: 1,
    });
  };

  const columns = listState.columns || [];

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{objectDef.name}</h2>
          <p className="text-sm text-gray-500">{objectDef.apiName}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/admin/${objectDef.apiName}/new?${backToListQuery}`}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Nuevo
          </Link>

          <Link
            to={`/admin/object/${objectDef.apiName}`}
            className="rounded bg-gray-200 px-4 py-2 text-black"
          >
            Configurar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div>
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <input
            type="text"
            placeholder="Buscar registros..."
            className="w-full rounded-lg border p-3"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParams({ search: searchInput.trim(), page: 1 });
              }
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Vista</label>
          <select
            className="min-w-48 rounded-lg border p-3"
            value={listState.viewApiName}
            onChange={(e) =>
              updateParams({
                view: e.target.value,
                page: 1,
                sortBy: undefined,
                sortOrder: undefined,
              })
            }
          >
            {(objectDef.listViews || []).map((view) => (
              <option key={view.apiName} value={view.apiName}>
                {view.label || view.name || view.apiName}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="rounded-lg border px-4 py-3"
          onClick={() => updateParams({ search: searchInput.trim(), page: 1 })}
        >
          Aplicar
        </button>
      </div>

      {loading ? (
        <p>Cargando registros...</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">No hay registros para esta vista.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  {columns.map((field) => (
                    <th key={field.apiName} className="border-b p-3">
                      <button
                        type="button"
                        className="font-semibold"
                        onClick={() => handleSort(field.apiName)}
                      >
                        {field.label}
                        {listState.sortBy === field.apiName
                          ? listState.sortOrder === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    </th>
                  ))}
                  <th className="border-b p-3">Creado</th>
                  <th className="border-b p-3">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    {columns.map((field) => (
                      <td key={field.apiName} className="border-b p-3">
                        {formatFieldValue(field, record[field.apiName], record)}
                      </td>
                    ))}

                    <td className="border-b p-3 text-sm text-gray-500">
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleString()
                        : "-"}
                    </td>

                    <td className="border-b p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/admin/${objectDef.apiName}/${record._id}/view?${backToListQuery}`}
                          className="rounded bg-blue-600 px-3 py-1 text-white"
                        >
                          Ver
                        </Link>

                        <Link
                          to={`/admin/${objectDef.apiName}/${record._id}?${backToListQuery}`}
                          className="rounded bg-yellow-500 px-3 py-1 text-white"
                        >
                          Editar
                        </Link>

                        <button
                          onClick={() => handleDelete(record._id)}
                          className="rounded bg-red-600 px-3 py-1 text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            pagination={pagination}
            onChangePage={(page) => updateParams({ page })}
          />
        </>
      )}
    </div>
  );
}

export default ObjectListView;
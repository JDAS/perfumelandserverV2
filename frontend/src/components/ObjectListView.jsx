import { useEffect, useMemo, useState } from "react";
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

  const listState = useMemo(() => buildListQuery({ searchParams, objectDef }), [searchParams, objectDef]);
  const backToListQuery = getBackToListSearch(searchParams, objectDef.apiName);

  useEffect(() => {
    setSearchInput(listState.search || "");
  }, [listState.search]);

  useEffect(() => {
    loadRecords();
  }, [objectDef?.apiName, listState.search, listState.page, listState.limit, listState.sortBy, listState.sortOrder, listState.viewApiName]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getRecords(objectDef.apiName, buildRecordListRequest({ objectDef, listState }));
      setRecords(data.records || []);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error(error);
      setRecords([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

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
      alert(error?.response?.data?.error || "Error eliminando el registro");
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

  const columns = listState.columns;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{objectDef.name}</h2>
          <p className="text-sm text-gray-500">{objectDef.apiName}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link to={`/admin/${objectDef.apiName}/new?${backToListQuery}`} className="bg-black text-white px-4 py-2 rounded">Nuevo</Link>
          <Link to={`/admin/object/${objectDef.apiName}`} className="bg-gray-200 text-black px-4 py-2 rounded">Configurar</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Buscar</label>
          <input
            type="text"
            placeholder="Buscar registros..."
            className="w-full border rounded-lg p-3"
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
          <label className="block text-sm font-medium mb-1">Vista</label>
          <select
            className="border rounded-lg p-3 min-w-48"
            value={listState.viewApiName}
            onChange={(e) => updateParams({ view: e.target.value, page: 1, sortBy: undefined, sortOrder: undefined })}
          >
            {(objectDef.listViews || []).map((view) => <option key={view.apiName} value={view.apiName}>{view.label}</option>)}
          </select>
        </div>
        <button type="button" className="rounded-lg border px-4 py-3" onClick={() => updateParams({ search: searchInput.trim(), page: 1 })}>Aplicar</button>
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
                    <th key={field.apiName} className="p-3 border-b">
                      <button type="button" className="font-semibold" onClick={() => handleSort(field.apiName)}>
                        {field.label}
                        {listState.sortBy === field.apiName ? (listState.sortOrder === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                  <th className="p-3 border-b">Creado</th>
                  <th className="p-3 border-b">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    {columns.map((field) => <td key={field.apiName} className="p-3 border-b">{formatFieldValue(field, record[field.apiName])}</td>)}
                    <td className="p-3 border-b text-sm text-gray-500">{record.createdAt ? new Date(record.createdAt).toLocaleString() : "-"}</td>
                    <td className="p-3 border-b">
                      <div className="flex gap-2 flex-wrap">
                        <Link to={`/admin/${objectDef.apiName}/${record._id}/view?${backToListQuery}`} className="px-3 py-1 bg-blue-600 text-white rounded">Ver</Link>
                        <Link to={`/admin/${objectDef.apiName}/${record._id}?${backToListQuery}`} className="px-3 py-1 bg-yellow-500 text-white rounded">Editar</Link>
                        <button onClick={() => handleDelete(record._id)} className="px-3 py-1 bg-red-600 text-white rounded">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onChangePage={(page) => updateParams({ page })} />
        </>
      )}
    </div>
  );
}

export default ObjectListView;

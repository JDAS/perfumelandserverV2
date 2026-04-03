import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRecords, deleteRecord } from "../services/customService";

function ObjectListView({ objectDef }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadRecords();
  }, [objectDef?.apiName]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getRecords(objectDef.apiName);
      setRecords(data || []);
    } catch (error) {
      console.error(error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("¿Eliminar este registro?");
    if (!confirmed) return;

    try {
      await deleteRecord(objectDef.apiName, id);
      setRecords((prev) => prev.filter((r) => r._id !== id));
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.error || "Error eliminando el registro"
      );
    }
  };

  const visibleFields = (objectDef.fields || []).slice(0, 5);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return records;

    return records.filter((record) =>
      visibleFields.some((field) => {
        const value = record[field.apiName];

        if (value === null || value === undefined) return false;

        return String(value).toLowerCase().includes(term);
      })
    );
  }, [records, search, visibleFields]);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{objectDef.name}</h2>
          <p className="text-sm text-gray-500">{objectDef.apiName}</p>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/admin/${objectDef.apiName}/new?tab=${objectDef.apiName}`}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Nuevo
          </Link>

          <Link
            to={`/admin/object/${objectDef.apiName}`}
            className="bg-gray-200 text-black px-4 py-2 rounded"
          >
            Configurar
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar registros..."
          className="w-full md:w-96 border rounded-lg p-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Cargando registros...</p>
      ) : filteredRecords.length === 0 ? (
        <p className="text-gray-500">
          {search
            ? "No hay resultados para la búsqueda."
            : "No hay registros para este objeto."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                {visibleFields.map((field) => (
                  <th key={field.apiName} className="p-3 border-b">
                    {field.label}
                  </th>
                ))}
                <th className="p-3 border-b">Creado</th>
                <th className="p-3 border-b">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record._id} className="hover:bg-gray-50">
                  {visibleFields.map((field) => (
                    <td key={field.apiName} className="p-3 border-b">
                      {record[field.apiName] ?? "-"}
                    </td>
                  ))}
                  <td className="p-3 border-b text-sm text-gray-500">
                    {record.createdAt
                      ? new Date(record.createdAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="p-3 border-b">
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/${objectDef.apiName}/${record._id}/view?tab=${objectDef.apiName}`}
                        className="px-3 py-1 bg-blue-600 text-white rounded"
                      >
                        Ver
                      </Link>

                      <Link
                        to={`/admin/${objectDef.apiName}/${record._id}?tab=${objectDef.apiName}`}
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                      >
                        Editar
                      </Link>

                      <button
                        onClick={() => handleDelete(record._id)}
                        className="px-3 py-1 bg-red-600 text-white rounded"
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
      )}
    </div>
  );
}

export default ObjectListView;
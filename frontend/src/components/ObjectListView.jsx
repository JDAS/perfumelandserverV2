import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecords } from "../services/customService";

function ObjectListView({ objectDef }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const visibleFields = (objectDef.fields || []).slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{objectDef.name}</h2>
          <p className="text-sm text-gray-500">{objectDef.apiName}</p>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/admin/${objectDef.apiName}/new`}
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

      {loading ? (
        <p>Cargando registros...</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">No hay registros para este objeto.</p>
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
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
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
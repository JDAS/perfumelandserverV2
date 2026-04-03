import { useEffect, useState } from "react";
import { getRecords } from "../../services/customService";

function LookupField({ field, value, onChange }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      if (!field?.referenceTo) {
        setOptions([]);
        return;
      }

      try {
        setLoading(true);

        const response = await getRecords(field.referenceTo, {
          page: 1,
          limit: 100,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        setOptions(response.records || []);
      } catch (error) {
        console.error("Error cargando opciones lookup:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [field?.referenceTo]);

  const getOptionLabel = (record) => {
    return (
      record?.name ||
      record?.label ||
      record?.title ||
      record?.fullName ||
      record?._id
    );
  };

  return (
    <select
      className="w-full rounded border p-2"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      disabled={loading}
    >
      <option value="">{loading ? "Cargando..." : "Seleccione"}</option>

      {options.map((record) => (
        <option key={record._id} value={record._id}>
          {getOptionLabel(record)}
        </option>
      ))}
    </select>
  );
}

export default LookupField;
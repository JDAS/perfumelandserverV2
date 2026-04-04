import { useEffect, useMemo, useRef, useState } from "react";
import { getLookupOptions, getRecordById } from "../../services/customService";

function getOptionLabel(record) {
  return (
    record?.name ||
    record?.label ||
    record?.title ||
    record?.fullName ||
    record?._id ||
    ""
  );
}

function LookupField({ field, value, onChange, record }) {
  const [options, setOptions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const cacheRef = useRef(new Map());

  const currentResolvedLabel = useMemo(() => {
    return (
      record?._lookup?.[field.apiName]?.label ||
      record?.[`${field.apiName}Label`] ||
      null
    );
  }, [record, field.apiName]);

  useEffect(() => {
    let cancelled = false;

    const loadSelected = async () => {
      if (!value) {
        setSelectedOption(null);
        return;
      }

      const cacheKey = `${field.referenceTo}:${value}`;
      const cached = cacheRef.current.get(cacheKey);

      if (cached) {
        setSelectedOption(cached);
        return;
      }

      if (currentResolvedLabel) {
        const option = { value, label: currentResolvedLabel };
        cacheRef.current.set(cacheKey, option);
        setSelectedOption(option);
        return;
      }

      try {
        const data = await getRecordById(field.referenceTo, value);
        if (cancelled) return;

        const option = {
          value: data._id,
          label: getOptionLabel(data),
        };

        cacheRef.current.set(cacheKey, option);
        setSelectedOption(option);
      } catch (error) {
        console.error("Error cargando lookup seleccionado:", error);
      }
    };

    loadSelected();

    return () => {
      cancelled = true;
    };
  }, [field.referenceTo, value, currentResolvedLabel]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const response = await getLookupOptions(field.referenceTo);
        if (cancelled) return;

        const rows = response.records || [];
        const nextOptions = rows.map((row) => ({
          value: row._id,
          label: getOptionLabel(row),
        }));

        nextOptions.forEach((opt) => {
          cacheRef.current.set(`${field.referenceTo}:${opt.value}`, opt);
        });

        const filtered = search.trim()
          ? nextOptions.filter((opt) =>
              opt.label.toLowerCase().includes(search.trim().toLowerCase())
            )
          : nextOptions;

        setOptions(filtered);
      } catch (error) {
        console.error("Error cargando opciones lookup:", error);
        setOptions([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [field.referenceTo, search]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        className="w-full rounded border p-2"
        placeholder={`Buscar ${field.label || field.apiName}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        className="w-full rounded border p-2"
        value={selectedOption?.value || value || ""}
        onChange={(e) => {
          const selectedValue = e.target.value || "";
          const option =
            options.find((opt) => String(opt.value) === String(selectedValue)) ||
            null;

          setSelectedOption(option);
          onChange(selectedValue);
        }}
      >
        <option value="">Seleccione...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {loading && <p className="text-sm text-gray-500">Cargando opciones...</p>}
    </div>
  );
}

export default LookupField;
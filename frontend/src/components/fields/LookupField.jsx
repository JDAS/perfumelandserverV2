import { useEffect, useRef, useState } from "react";
import { getRecordById, getRecords } from "../../services/customService";

function LookupField({ field, value, onChange }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);

  const getOptionLabel = (record) => {
    return (
      record?.name ||
      record?.label ||
      record?.title ||
      record?.fullName ||
      record?._lookupLabel ||
      record?._id
    );
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadSelectedRecord() {
      if (!field?.referenceTo || !value) {
        setSelectedRecord(null);
        setSearch("");
        return;
      }

      try {
        const record = await getRecordById(field.referenceTo, value);
        setSelectedRecord(record);
        setSearch(getOptionLabel(record));
      } catch (error) {
        console.error("Error cargando valor seleccionado del lookup:", error);
        setSelectedRecord(null);
      }
    }

    loadSelectedRecord();
  }, [field?.referenceTo, value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchRecords(search);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, field?.referenceTo]);

  const searchRecords = async (term) => {
    if (!field?.referenceTo || !open) {
      return;
    }

    try {
      setLoading(true);

      const response = await getRecords(field.referenceTo, {
        page: 1,
        limit: 10,
        search: term?.trim() || "",
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      setResults(response.records || []);
    } catch (error) {
      console.error("Error buscando lookup:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (record) => {
    setSelectedRecord(record);
    setSearch(getOptionLabel(record));
    onChange(record._id);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedRecord(null);
    setSearch("");
    setResults([]);
    onChange("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-2">
        <input
          type="text"
          className="w-full rounded border p-2"
          placeholder={
            field?.referenceTo
              ? `Buscar en ${field.referenceTo}...`
              : "Buscar..."
          }
          value={search}
          onChange={(e) => {
            const nextValue = e.target.value;
            setSearch(nextValue);
            setOpen(true);

            if (!nextValue.trim()) {
              setSelectedRecord(null);
              onChange("");
              setResults([]);
            }
          }}
          onFocus={() => setOpen(true)}
        />

        {(value || search) && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded border bg-gray-50 px-3 py-2 hover:bg-gray-100"
          >
            Limpiar
          </button>
        )}
      </div>

      {selectedRecord && value && (
        <div className="mt-2 text-xs text-gray-500">
          Seleccionado:{" "}
          <span className="font-medium">{getOptionLabel(selectedRecord)}</span>
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border bg-white shadow-lg">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">
              No se encontraron resultados
            </div>
          ) : (
            results.map((record) => (
              <button
                key={record._id}
                type="button"
                className="block w-full border-b px-3 py-2 text-left hover:bg-gray-50"
                onClick={() => handleSelect(record)}
              >
                <div className="font-medium">{getOptionLabel(record)}</div>
                <div className="text-xs text-gray-500">{record._id}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default LookupField;
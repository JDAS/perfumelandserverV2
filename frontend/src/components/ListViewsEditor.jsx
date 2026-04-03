import React from "react";

const createEmptyView = () => ({
  name: "",
  apiName: "",
  columns: [],
  filters: [],
  isDefault: false,
});

const createEmptyFilter = () => ({
  field: "",
  operator: "eq",
  value: "",
});

function ListViewsEditor({ objectDef, value = [], onChange }) {
  const fields = objectDef?.fields || [];

  const updateViews = (nextViews) => {
    onChange(nextViews);
  };

  const handleAddView = () => {
    updateViews([...(value || []), createEmptyView()]);
  };

  const handleRemoveView = (index) => {
    const next = [...value];
    next.splice(index, 1);
    updateViews(next);
  };

  const handleUpdateView = (index, patch) => {
    const next = [...value];
    next[index] = {
      ...next[index],
      ...patch,
    };
    updateViews(next);
  };

  const handleSetDefault = (index) => {
    const next = (value || []).map((view, i) => ({
      ...view,
      isDefault: i === index,
    }));
    updateViews(next);
  };

  const handleToggleColumn = (viewIndex, fieldApiName) => {
    const next = [...value];
    const currentColumns = next[viewIndex].columns || [];

    if (currentColumns.includes(fieldApiName)) {
      next[viewIndex].columns = currentColumns.filter(
        (col) => col !== fieldApiName
      );
    } else {
      next[viewIndex].columns = [...currentColumns, fieldApiName];
    }

    updateViews(next);
  };

  const handleAddFilter = (viewIndex) => {
    const next = [...value];
    next[viewIndex].filters = [
      ...(next[viewIndex].filters || []),
      createEmptyFilter(),
    ];
    updateViews(next);
  };

  const handleRemoveFilter = (viewIndex, filterIndex) => {
    const next = [...value];
    next[viewIndex].filters.splice(filterIndex, 1);
    updateViews(next);
  };

  const handleUpdateFilter = (viewIndex, filterIndex, patch) => {
    const next = [...value];
    next[viewIndex].filters[filterIndex] = {
      ...next[viewIndex].filters[filterIndex],
      ...patch,
    };
    updateViews(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Views</h2>
        <button
          type="button"
          onClick={handleAddView}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Agregar vista
        </button>
      </div>

      {(!value || value.length === 0) && (
        <div className="rounded border border-dashed p-4 text-sm text-gray-500">
          No hay vistas configuradas.
        </div>
      )}

      {(value || []).map((view, viewIndex) => (
        <div
          key={viewIndex}
          className="space-y-4 rounded border bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre</label>
                <input
                  type="text"
                  value={view.label || ""}
                  onChange={(e) =>
                    handleUpdateView(viewIndex, { label: e.target.value })
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  API Name
                </label>
                <input
                  type="text"
                  value={view.apiName || ""}
                  onChange={(e) =>
                    handleUpdateView(viewIndex, { apiName: e.target.value })
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!view.isDefault}
                    onChange={() => handleSetDefault(viewIndex)}
                  />
                  Vista por defecto
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveView(viewIndex)}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Eliminar vista
            </button>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Columnas</label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {fields.map((field) => (
                <label
                  key={field.apiName}
                  className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={(view.columns || []).includes(field.apiName)}
                    onChange={() =>
                      handleToggleColumn(viewIndex, field.apiName)
                    }
                  />
                  {field.label} ({field.apiName})
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Filtros</h3>
              <button
                type="button"
                onClick={() => handleAddFilter(viewIndex)}
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Agregar filtro
              </button>
            </div>

            {(!view.filters || view.filters.length === 0) && (
              <div className="text-sm text-gray-500">
                Esta vista no tiene filtros.
              </div>
            )}

            {(view.filters || []).map((filter, filterIndex) => (
              <div
                key={filterIndex}
                className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-4"
              >
                <div>
                  <label className="mb-1 block text-sm font-medium">Campo</label>
                  <select
                    value={filter.field || ""}
                    onChange={(e) =>
                      handleUpdateFilter(viewIndex, filterIndex, {
                        field: e.target.value,
                      })
                    }
                    className="w-full rounded border px-3 py-2"
                  >
                    <option value="">Seleccione</option>
                    {fields.map((field) => (
                      <option key={field.apiName} value={field.apiName}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Operador
                  </label>
                  <select
                    value={filter.operator || "eq"}
                    onChange={(e) =>
                      handleUpdateFilter(viewIndex, filterIndex, {
                        operator: e.target.value,
                      })
                    }
                    className="w-full rounded border px-3 py-2"
                  >
                    <option value="eq">Igual</option>
                    <option value="ne">Distinto</option>
                    <option value="gt">Mayor que</option>
                    <option value="gte">Mayor o igual</option>
                    <option value="lt">Menor que</option>
                    <option value="lte">Menor o igual</option>
                    <option value="contains">Contiene</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Valor</label>
                  <input
                    type="text"
                    value={filter.value ?? ""}
                    onChange={(e) =>
                      handleUpdateFilter(viewIndex, filterIndex, {
                        value: e.target.value,
                      })
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveFilter(viewIndex, filterIndex)}
                    className="w-full rounded bg-red-600 px-3 py-2 text-white hover:bg-red-700"
                  >
                    Eliminar filtro
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListViewsEditor;
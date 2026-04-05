import { useState } from 'react';
import { createObject as createCustomObject } from '../services/customService';

function optionsToMultiline(options = []) {
  return options.join('\n');
}

function multilineToOptions(value = '') {
  return value
    .split(/\r?\n/)
    .map((opt) => opt.trim())
    .filter(Boolean);
}

function normalizeDateDefaultValue(defaultValue) {
  if (
    defaultValue &&
    typeof defaultValue === 'object' &&
    !Array.isArray(defaultValue)
  ) {
    return {
      mode: defaultValue.mode === 'relative' ? 'relative' : 'fixed',
      value: String(defaultValue.value || ''),
      offsetDays: Number(defaultValue.offsetDays || 0),
    };
  }

  return {
    mode: 'fixed',
    value: String(defaultValue || ''),
    offsetDays: 0,
  };
}

function buildDateDefaultValue(dateDefault) {
  if (!dateDefault) return '';

  if (dateDefault.mode === 'relative') {
    return {
      mode: 'relative',
      offsetDays: Number(dateDefault.offsetDays || 0),
    };
  }

  return String(dateDefault.value || '').trim();
}

function Builder() {
  const [name, setName] = useState('');
  const [apiName, setApiName] = useState('');
  const [fields, setFields] = useState([]);

  const [field, setField] = useState({
    label: '',
    apiName: '',
    type: 'text',
    required: false,
    options: [],
    defaultValue: '',
  });

  const normalizeApiName = (value) => value.toLowerCase().trim().replace(/\s+/g, '_');

  const addField = () => {
    if (!field.label.trim()) {
      alert('El label del campo es obligatorio');
      return;
    }

    const finalApiName = field.apiName?.trim()
      ? normalizeApiName(field.apiName)
      : normalizeApiName(field.label);

    const newField = {
      label: field.label.trim(),
      apiName: finalApiName,
      type: field.type,
      required: field.required,
      options: field.type === 'select' ? field.options || [] : [],
      defaultValue:
        field.type === 'boolean'
          ? Boolean(field.defaultValue)
          : field.type === 'date'
            ? buildDateDefaultValue(normalizeDateDefaultValue(field.defaultValue))
          : String(field.defaultValue ?? '').trim(),
    };

    setFields((prev) => [...prev, newField]);
    setField({
      label: '',
      apiName: '',
      type: 'text',
      required: false,
      options: [],
      defaultValue: '',
    });
  };

  const createObject = async () => {
    if (!name.trim()) {
      alert('El nombre del objeto es obligatorio');
      return;
    }

    const finalApiName = apiName.trim() ? normalizeApiName(apiName) : normalizeApiName(name);

    try {
      await createCustomObject({
        name: name.trim(),
        apiName: finalApiName,
        fields,
        layout: [
          {
            label: 'principal',
            apiName: 'principal',
            sections: [
              {
                label: 'Detalles',
                columns: 2,
                fields: fields.length > 0 ? fields.map((f) => f.apiName) : ['name'],
              },
            ],
          },
        ],
      });

      alert('Objeto creado 🚀');
      setName('');
      setApiName('');
      setFields([]);
      setField({
        label: '',
        apiName: '',
        type: 'text',
        required: false,
        options: [],
        defaultValue: '',
      });
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || error?.response?.data?.message || 'Error al crear el objeto');
    }
  };

  return (
    <div className="p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Builder</h1>

      <input
        placeholder="Nombre"
        className="border p-2 w-full mb-3"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="API Name (ej: product)"
        className="border p-2 w-full mb-6"
        value={apiName}
        onChange={(e) => setApiName(e.target.value)}
      />

      <h2 className="font-bold mb-2">Campos</h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          placeholder="Label"
          className="border p-2"
          value={field.label}
          onChange={(e) => setField({ ...field, label: e.target.value })}
        />

        <input
          placeholder="API Name"
          className="border p-2"
          value={field.apiName}
          onChange={(e) => setField({ ...field, apiName: e.target.value })}
        />

        <select
          className="border p-2"
          value={field.type}
          onChange={(e) => setField({ ...field, type: e.target.value, options: [], defaultValue: '' })}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
          <option value="boolean">Boolean</option>
          <option value="date">Date</option>
        </select>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => setField({ ...field, required: e.target.checked })}
          />
          <span className="ml-2">Required</span>
        </label>

        {field.type === 'select' && (
          <>
            <textarea
              placeholder={'Una opcion por linea\nActivo\nInactivo\nPendiente, con coma'}
              className="border p-2 col-span-2"
              rows={4}
              value={optionsToMultiline(field.options)}
              onChange={(e) =>
                setField({
                  ...field,
                  options: multilineToOptions(e.target.value),
                })
              }
            />
            <select
              className="border p-2 col-span-2"
              value={field.defaultValue ?? ''}
              onChange={(e) => setField({ ...field, defaultValue: e.target.value })}
            >
              <option value="">Sin valor por defecto</option>
              {(field.options || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )}

        {field.type === 'boolean' && (
          <label className="flex items-center col-span-2">
            <input
              type="checkbox"
              checked={Boolean(field.defaultValue)}
              onChange={(e) => setField({ ...field, defaultValue: e.target.checked })}
            />
            <span className="ml-2">Valor por defecto</span>
          </label>
        )}

        {field.type === 'date' && (
          <>
            <select
              className="border p-2 col-span-2"
              value={normalizeDateDefaultValue(field.defaultValue).mode}
              onChange={(e) =>
                setField({
                  ...field,
                  defaultValue:
                    e.target.value === 'relative'
                      ? { mode: 'relative', offsetDays: 0 }
                      : { mode: 'fixed', value: '' },
                })
              }
            >
              <option value="fixed">Fecha fija</option>
              <option value="relative">Hoy +/- dias</option>
            </select>
            {normalizeDateDefaultValue(field.defaultValue).mode === 'relative' ? (
              <input
                placeholder="Dias desde hoy"
                className="border p-2 col-span-2"
                type="number"
                value={normalizeDateDefaultValue(field.defaultValue).offsetDays}
                onChange={(e) =>
                  setField({
                    ...field,
                    defaultValue: {
                      mode: 'relative',
                      offsetDays: Number(e.target.value || 0),
                    },
                  })
                }
              />
            ) : (
              <input
                className="border p-2 col-span-2"
                type="date"
                value={normalizeDateDefaultValue(field.defaultValue).value}
                onChange={(e) =>
                  setField({
                    ...field,
                    defaultValue: {
                      mode: 'fixed',
                      value: e.target.value,
                    },
                  })
                }
              />
            )}
          </>
        )}

        {!['select', 'boolean', 'date'].includes(field.type) && (
          <input
            placeholder="Valor por defecto"
            className="border p-2 col-span-2"
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={field.defaultValue ?? ''}
            onChange={(e) => setField({ ...field, defaultValue: e.target.value })}
          />
        )}
      </div>

      <button onClick={addField} className="bg-gray-200 px-4 py-2 mb-6" type="button">
        Agregar campo
      </button>

      <div className="mb-6">
        {fields.map((f, i) => (
          <div key={`${f.apiName}-${i}`} className="text-sm">
            {f.label} - {f.apiName} ({f.type})
          </div>
        ))}
      </div>

      <button onClick={createObject} className="bg-black text-white w-full py-2" type="button">
        Crear Objeto
      </button>
    </div>
  );
}

export default Builder;

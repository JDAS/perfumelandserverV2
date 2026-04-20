import { useEffect, useMemo, useState } from "react";
import { renderFieldInput } from "../../fields/FieldRegistry";
import { useToast } from "../../ui/ToastContext";
import {
  getFormFields,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../../../engine/metadataEngine";
import {
  createRecord,
  getRecordById,
  updateRecord,
} from "../../../services/customService";
import { adminTheme } from "../../../theme/adminTheme";

function formatValueForInput(field, value) {
  if (value === undefined || value === null || value === "") return "";
  if (field.type === "boolean") return Boolean(value);

  if (field.type === "date") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  if (field.type === "datetime") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  return value;
}

function resolveDateDefaultValue(defaultValue) {
  if (
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue) &&
    defaultValue.mode === "relative"
  ) {
    const today = new Date();
    const resolved = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + (Number(defaultValue.offsetDays) || 0)
    );

    return resolved.toISOString().slice(0, 10);
  }

  if (defaultValue && typeof defaultValue === "object" && !Array.isArray(defaultValue)) {
    return defaultValue.value || "";
  }

  return defaultValue;
}

function getFieldDefaultValue(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== "") {
    const defaultValue =
      field.type === "date"
        ? resolveDateDefaultValue(field.defaultValue)
        : field.defaultValue;

    return formatValueForInput(field, defaultValue);
  }

  return field.type === "boolean" ? false : "";
}

export function CreateRecordModal({
  open,
  objectDef,
  onClose,
  onCreated,
  initialValues = {},
}) {
  const { addToast } = useToast();
  const fields = useMemo(() => getFormFields(objectDef), [objectDef]);
  const activeLayout = objectDef?.layout?.[0];
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialState = Object.fromEntries(
      fields.map((field) => [field.apiName, getFieldDefaultValue(field)])
    );
    setFormData({ ...initialState, ...initialValues });
  }, [fields, initialValues, open]);

  if (!open || !objectDef) return null;

  const handleChange = (apiName, value) => {
    setFormData((prev) => ({ ...prev, [apiName]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    for (const field of fields) {
      const value = formData[field.apiName];
      if (field.required && (value === undefined || value === null || value === "")) {
        addToast(`${field.label} es requerido`, "warning");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = Object.fromEntries(
        fields
          .filter((field) => !["formula", "rollup"].includes(field.type))
          .map((field) => [field.apiName, formData[field.apiName]])
      );
      const createdRecord = await createRecord(objectDef.apiName, payload);
      addToast("Registro creado", "success");
      await onCreated?.(createdRecord);
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo crear el registro", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return (
        <div
          key={`${item}-${index}`}
          className="h-[72px] rounded-xl border-2 border-dashed"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surfaceAlt }}
        />
      );
    }

    const field = fields.find((currentField) => currentField.apiName === item);
    if (!field) return null;

    return (
      <div key={field.apiName} className="mb-3">
        {field.type !== "boolean" ? (
          <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
            {field.label}
            {field.required ? <span className="ml-1 text-red-500">*</span> : null}
          </label>
        ) : null}

        {renderFieldInput(
          field,
          formData[field.apiName],
          (value) => handleChange(field.apiName, value),
          { objectDef, formData, setFormData }
        )}
      </div>
    );
  };

  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: adminTheme.border }}
        >
          <div>
            <h2 className="text-xl font-semibold" style={{ color: adminTheme.text }}>
              Nuevo {objectDef.name}
            </h2>
            <p className="text-sm" style={{ color: adminTheme.muted }}>
              Crea el registro sin salir del workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
            {fieldSections.length ? (
              <div className="space-y-5">
                {fieldSections.map((section, sectionIndex) => {
                  const sectionFields = section.fields || [];
                  const twoColumn = section.columns === 2;
                  const { col1, col2 } = splitFieldsIntoColumns(sectionFields);

                  return (
                    <div key={`${section.label || "section"}-${sectionIndex}`}>
                      {section.label ? (
                        <div className="mb-4">
                          <p
                            className="text-xs uppercase tracking-[0.22em]"
                            style={{ color: adminTheme.muted }}
                          >
                            {section.label}
                          </p>
                        </div>
                      ) : null}

                      {twoColumn ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>{col1.map((item, index) => renderFieldOrBlank(item, index))}</div>
                          <div>{col2.map((item, index) => renderFieldOrBlank(item, index + col1.length))}</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {sectionFields.map((item, index) => renderFieldOrBlank(item, index))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {fields.map((field, index) => renderFieldOrBlank(field.apiName, index))}
              </div>
            )}
          </div>

          <div
            className="flex justify-end gap-3 border-t px-6 py-4"
            style={{ borderColor: adminTheme.border }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: adminTheme.border, color: adminTheme.text }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: adminTheme.text }}
            >
              {saving ? "Guardando..." : "Crear registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditRecordPanel({ objectDef, recordId, onSaved, actions = null }) {
  const { addToast } = useToast();
  const fields = useMemo(() => getFormFields(objectDef), [objectDef]);
  const activeLayout = objectDef?.layout?.[0];
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecord() {
      try {
        setLoading(true);
        const record = await getRecordById(objectDef.apiName, recordId);
        if (cancelled) return;

        const nextState = Object.fromEntries(
          fields.map((field) => [field.apiName, formatValueForInput(field, record?.[field.apiName])])
        );
        setFormData(nextState);
      } catch (error) {
        console.error(error);
        if (!cancelled) setFormData({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRecord();
    return () => {
      cancelled = true;
    };
  }, [fields, objectDef.apiName, recordId]);

  const handleChange = (apiName, value) => {
    setFormData((prev) => ({ ...prev, [apiName]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    for (const field of fields) {
      const value = formData[field.apiName];
      if (field.required && (value === undefined || value === null || value === "")) {
        addToast(`${field.label} es requerido`, "warning");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = Object.fromEntries(
        fields
          .filter((field) => !["formula", "rollup"].includes(field.type))
          .map((field) => [field.apiName, formData[field.apiName]])
      );
      const updated = await updateRecord(objectDef.apiName, recordId, payload);
      addToast("Registro actualizado", "success");
      await onSaved?.(updated);
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo actualizar el registro", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return (
        <div
          key={`${item}-${index}`}
          className="h-[72px] rounded-xl border-2 border-dashed"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surfaceAlt }}
        />
      );
    }

    const field = fields.find((currentField) => currentField.apiName === item);
    if (!field) return null;

    return (
      <div key={field.apiName} className="mb-3">
        {field.type !== "boolean" ? (
          <label className="mb-1 block text-sm font-medium" style={{ color: adminTheme.text }}>
            {field.label}
            {field.required ? <span className="ml-1 text-red-500">*</span> : null}
          </label>
        ) : null}

        {renderFieldInput(
          field,
          formData[field.apiName],
          (value) => handleChange(field.apiName, value),
          { objectDef, formData, setFormData }
        )}
      </div>
    );
  };

  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <p style={{ color: adminTheme.muted }}>Cargando formulario...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {actions ? actions({ saving }) : null}
      {fieldSections.length ? (
        <div className="space-y-5">
          {fieldSections.map((section, sectionIndex) => {
            const sectionFields = section.fields || [];
            const twoColumn = section.columns === 2;
            const { col1, col2 } = splitFieldsIntoColumns(sectionFields);

            return (
              <div key={`${section.label || "section"}-${sectionIndex}`}>
                {section.label ? (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
                      {section.label}
                    </p>
                  </div>
                ) : null}
                {twoColumn ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>{col1.map((item, index) => renderFieldOrBlank(item, index))}</div>
                    <div>{col2.map((item, index) => renderFieldOrBlank(item, index + col1.length))}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sectionFields.map((item, index) => renderFieldOrBlank(item, index))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map((field, index) => renderFieldOrBlank(field.apiName, index))}
        </div>
      )}
    </form>
  );
}

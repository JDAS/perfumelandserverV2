import LookupField from "./LookupField";

function BaseInput({ type = "text", value, onChange, className = "", ...props }) {
  return (
    <input
      type={type}
      className={`w-full rounded border p-2 ${className}`}
      value={value ?? ""}
      onChange={onChange}
      {...props}
    />
  );
}

export function renderFieldInput(field, value, onValueChange, context = {}) {
  const { formData, setFormData } = context;

  const commonProps = {
    value: field.type === "boolean" ? undefined : value ?? "",
    onChange: (event) => onValueChange(event.target.value),
  };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="min-h-28 w-full rounded border p-2"
          value={value ?? ""}
          onChange={(event) => onValueChange(event.target.value)}
        />
      );

    case "number":
      return <BaseInput type="number" {...commonProps} />;

    case "date":
      return <BaseInput type="date" {...commonProps} />;

    case "email":
      return <BaseInput type="email" {...commonProps} />;

    case "phone":
      return <BaseInput type="tel" {...commonProps} />;

    case "url":
      return <BaseInput type="url" {...commonProps} />;

    case "boolean":
      return (
        <label className="inline-flex items-center gap-2 rounded border bg-gray-50 p-3">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onValueChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );

    case "select":
      return (
        <select
          className="w-full rounded border p-2"
          value={value ?? ""}
          onChange={(event) => onValueChange(event.target.value)}
        >
          <option value="">Seleccione</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "lookup":
      return (
        <LookupField
          field={field}
          value={value ?? ""}
          onChange={onValueChange}
          formData={formData}
          setFormData={setFormData}
        />
      );

    default:
      return <BaseInput type="text" {...commonProps} />;
  }
}
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

export function renderFieldInput(field, value, onValueChange) {
  const commonProps = {
    value: field.type === "boolean" ? undefined : value ?? "",
    onChange: (event) => onValueChange(event.target.value),
  };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="w-full rounded border p-2 min-h-28"
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
        <label className="inline-flex items-center gap-2 rounded border p-3 bg-gray-50">
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
    default:
      return <BaseInput type="text" {...commonProps} />;
  }
}

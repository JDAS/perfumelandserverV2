import { adminTheme } from "../../../theme/adminTheme";

export function MetricCard({ label, value, tone = "default" }) {
  const tones = {
    default: { bg: adminTheme.surface, fg: adminTheme.text },
    alert: { bg: "#FEF2F2", fg: "#991B1B" },
    accent: { bg: adminTheme.surfaceAlt, fg: adminTheme.accentDeep },
  };

  const palette = tones[tone] || tones.default;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: palette.bg, borderColor: adminTheme.border }}
    >
      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: palette.fg }}>
        {value}
      </p>
    </div>
  );
}

export function PanelShell({ icon, title, description, actions, children }) {
  const IconComponent = icon;

  return (
    <section
      className="rounded-3xl border p-5"
      style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.accentDeep }}
          >
            <IconComponent className="h-5 w-5" strokeWidth={2.1} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: adminTheme.text }}>
              {title}
            </h3>
            <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
              {description}
            </p>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

export function DataTable({ columns, rows, emptyLabel }) {
  if (!rows.length) {
    return (
      <div
        className="rounded-2xl border p-5 text-sm"
        style={{ backgroundColor: adminTheme.surfaceAlt, borderColor: adminTheme.border, color: adminTheme.muted }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: adminTheme.border }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ backgroundColor: adminTheme.surfaceAlt }}>
            {columns.map((column) => (
              <th
                key={column.id}
                className="border-b p-3 text-left font-semibold"
                style={{ borderColor: adminTheme.border, color: adminTheme.text }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className="border-b p-3"
                  style={{ borderColor: adminTheme.border, color: adminTheme.text }}
                >
                  {column.render ? column.render(row) : row[column.id] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

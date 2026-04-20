import { X } from "lucide-react";
import { adminTheme } from "../../../theme/adminTheme";

export function LauncherChip({ active, label, onClick, icon: Icon = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
      style={
        active
          ? {
              backgroundColor: adminTheme.text,
              color: "#FFFFFF",
              borderColor: adminTheme.text,
            }
          : {
              backgroundColor: adminTheme.surface,
              color: adminTheme.text,
              borderColor: adminTheme.border,
            }
      }
    >
      {Icon ? <Icon className="h-4 w-4" strokeWidth={2} /> : null}
      {label}
    </button>
  );
}

export function ClassicTab({ active, label, onClick, onClose, closable = false }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-3 text-sm font-medium"
      style={
        active
          ? {
              backgroundColor: adminTheme.surface,
              color: adminTheme.text,
              borderColor: adminTheme.border,
              transform: "translateY(1px)",
            }
          : {
              backgroundColor: adminTheme.surfaceAlt,
              color: adminTheme.muted,
              borderColor: adminTheme.border,
            }
      }
    >
      <button type="button" onClick={onClick} className="text-left">
        {label}
      </button>
      {closable ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold transition"
          title={`Cerrar ${label}`}
          aria-label={`Cerrar ${label}`}
          style={
            active
              ? {
                  backgroundColor: adminTheme.surfaceAlt,
                  color: adminTheme.muted,
                }
              : {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  color: adminTheme.muted,
                }
          }
        >
          <X className="h-3 w-3" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}

export function BadgeChip({ active, label, onClick, onClose, closable = false }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
      style={
        active
          ? {
              backgroundColor: adminTheme.text,
              color: "#FFFFFF",
              borderColor: adminTheme.text,
            }
          : {
              backgroundColor: adminTheme.surfaceAlt,
              color: adminTheme.muted,
              borderColor: adminTheme.border,
            }
      }
    >
      <button type="button" onClick={onClick} className="text-left">
        {label}
      </button>
      {closable ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-semibold transition"
          title={`Cerrar ${label}`}
          aria-label={`Cerrar ${label}`}
          style={
            active
              ? {
                  backgroundColor: "rgba(255,255,255,0.16)",
                  color: "#FFFFFF",
                }
              : {
                  backgroundColor: adminTheme.surface,
                  color: adminTheme.muted,
                }
          }
        >
          <X className="h-3 w-3" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}

export function WorkspaceHeader({ activeTab, levelThreeAvailable }) {
  const title =
    activeTab?.type === "home"
      ? "Inicio"
      : activeTab?.type === "list"
        ? `${activeTab.label} · Lista`
        : `${activeTab?.label || "Registro abierto"}`;

  const description =
    activeTab?.type === "home"
      ? "Tab fijo de arranque. Por ahora muestra el reporte financiero."
      : activeTab?.type === "list"
        ? "La lista vive en nivel 2 y desde aqui puedes abrir registros de cualquier objeto."
        : "Los relacionados del registro activo viven como badges en nivel 3 dentro del mismo contexto.";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
          Area de trabajo
        </p>
        <h2 className="mt-1 text-xl font-semibold" style={{ color: adminTheme.text }}>
          {title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
          {description}
        </p>
      </div>

      {levelThreeAvailable ? (
        <div
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: adminTheme.surfaceAlt, color: adminTheme.muted }}
        >
          Nivel 3 disponible
        </div>
      ) : null}
    </div>
  );
}

export function QuickActionButton({ icon: Icon = null, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold disabled:opacity-60 ${className}`}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" strokeWidth={2} /> : null}
    </button>
  );
}

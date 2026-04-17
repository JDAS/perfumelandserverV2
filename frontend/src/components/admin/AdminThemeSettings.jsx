import { DEFAULT_LOGO_URL } from "../../constants/branding";
import {
  ADMIN_THEME_FIELDS,
  DEFAULT_ADMIN_THEME,
  adminGradient,
} from "../../theme/adminTheme";

function AdminThemeSettings({
  value = DEFAULT_ADMIN_THEME,
  saving = false,
  onChange,
  onReset,
  onSave,
}) {
  const preview = {
    ...DEFAULT_ADMIN_THEME,
    ...value,
  };

  return (
    <form onSubmit={onSave} className="space-y-6">
      <section className="rounded-2xl border p-6" style={{ borderColor: preview.border }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold" style={{ color: preview.text }}>
              Identidad interna de Vitra
            </h3>
            <p className="mt-1 text-sm" style={{ color: preview.muted }}>
              Esta paleta afecta login, admin, configuracion y workspace lab.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: preview.border, color: preview.text }}
            >
              Restaurar defaults
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: adminGradient(preview) }}
            >
              {saving ? "Guardando..." : "Guardar tema Vitra"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6" style={{ borderColor: preview.border }}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold" style={{ color: preview.text }}>
            Paleta
          </h3>
          <p className="mt-1 text-sm" style={{ color: preview.muted }}>
            Puedes ajustar los colores base del shell interno y ver el resultado en vivo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_THEME_FIELDS.map((field) => (
            <label key={field.key} className="rounded-2xl border p-4" style={{ borderColor: preview.border }}>
              <span className="text-sm font-medium" style={{ color: preview.text }}>
                {field.label}
              </span>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={preview[field.key]}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border bg-transparent p-1"
                  style={{ borderColor: preview.border }}
                />
                <input
                  type="text"
                  value={preview[field.key]}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
                  style={{ borderColor: preview.border, color: preview.text }}
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border p-6" style={{ borderColor: preview.border }}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold" style={{ color: preview.text }}>
            Preview
          </h3>
          <p className="mt-1 text-sm" style={{ color: preview.muted }}>
            Una vista compacta del header y componentes principales del admin.
          </p>
        </div>

        <div
          className="overflow-hidden rounded-[28px] border"
          style={{ borderColor: preview.border, backgroundColor: preview.bg }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 text-white"
            style={{
              background: adminGradient(preview),
              borderColor: `${preview.surface}22`,
            }}
          >
            <div className="rounded-2xl bg-white/95 px-4 py-2 shadow-[0_10px_28px_rgba(14,43,87,0.18)]">
              <img src={DEFAULT_LOGO_URL} alt="Vitra" className="h-10 w-auto" />
            </div>

            <div
              className="rounded-2xl border px-3 py-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.16)",
              }}
            >
              <div className="text-sm font-semibold">Usuario admin</div>
              <div className="text-xs text-white/70">preview@vitra.app</div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div
              className="rounded-[24px] border p-5 shadow-[0_16px_40px_rgba(14,43,87,0.08)]"
              style={{ backgroundColor: preview.surface, borderColor: preview.border }}
            >
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: preview.muted }}>
                Workspace
              </p>
              <h4 className="mt-2 text-2xl font-semibold" style={{ color: preview.text }}>
                Admin de Vitra
              </h4>
              <p className="mt-2 text-sm leading-6" style={{ color: preview.muted }}>
                Un shell interno mas alineado al logo a color y con una paleta propia editable.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: adminGradient(preview) }}
                >
                  Accion principal
                </button>
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: preview.surfaceAlt,
                    borderColor: preview.border,
                    color: preview.text,
                  }}
                >
                  Secundaria
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div
                className="rounded-[22px] border p-4"
                style={{ backgroundColor: preview.surface, borderColor: preview.border }}
              >
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: preview.accent }}>
                  Accent
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: preview.text }}>
                  Botones y acentos suaves
                </p>
              </div>

              <div
                className="rounded-[22px] border p-4"
                style={{ backgroundColor: preview.surfaceAlt, borderColor: preview.border }}
              >
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: preview.accentDeep }}>
                  Accent Deep
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: preview.text }}>
                  Estados y detalles de mas peso
                </p>
              </div>

              <div
                className="rounded-[22px] border p-4"
                style={{ backgroundColor: preview.surface, borderColor: preview.border }}
              >
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: preview.muted }}>
                  Border
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: preview.text }}>
                  Separadores y contenedores
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}

export default AdminThemeSettings;

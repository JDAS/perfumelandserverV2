import { DEFAULT_LOGO_URL } from "../../constants/branding";
import {
  ADMIN_THEME_FIELDS,
  DEFAULT_ADMIN_THEME,
  adminGradient,
} from "../../theme/adminTheme";

function ThemeSwatches({ palette = {}, borderColor }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(palette)
        .slice(0, 5)
        .map(([key, value]) => (
          <div key={key} className="space-y-1 text-center">
            <div
              className="h-8 w-8 rounded-full border"
              style={{ backgroundColor: value, borderColor }}
            />
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{key}</p>
          </div>
        ))}
    </div>
  );
}

function AdminThemeSettings({
  value = DEFAULT_ADMIN_THEME,
  availableThemes = [],
  saving = false,
  onApplyTheme,
  onChange,
  onReset,
  onSave,
}) {
  const preview = {
    ...DEFAULT_ADMIN_THEME,
    ...value,
  };
  const selectedTheme = availableThemes.find((theme) => theme.id === preview.themeId);

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
            Paleta base
          </h3>
          <p className="mt-1 text-sm" style={{ color: preview.muted }}>
            Elige un preset como punto de partida, igual que en el storefront.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
          <label className="space-y-2">
            <span className="text-sm font-medium" style={{ color: preview.text }}>
              Preset de Vitra
            </span>
            <select
              className="w-full rounded-xl border p-3"
              value={preview.themeId || "custom"}
              onChange={(event) => {
                if (event.target.value !== "custom") {
                  onApplyTheme(event.target.value);
                }
              }}
              style={{
                borderColor: preview.border,
                backgroundColor: preview.surface,
                color: preview.text,
              }}
            >
              {availableThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </label>

          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: preview.border, backgroundColor: preview.surfaceAlt }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: preview.text }}>
                  {selectedTheme?.name || "Personalizado"}
                </p>
                <p className="mt-1 text-sm" style={{ color: preview.muted }}>
                  {selectedTheme?.description ||
                    "Estas usando una combinacion manual que ya no coincide con un preset."}
                </p>
              </div>

              {preview.themeId === "custom" && (
                <span
                  className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    borderColor: preview.border,
                    backgroundColor: preview.surface,
                    color: preview.accentDeep,
                  }}
                >
                  Custom
                </span>
              )}
            </div>
          </div>
        </div>

        {availableThemes.length > 0 && (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {availableThemes.map((theme) => {
              const isActive = preview.themeId === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onApplyTheme(theme.id)}
                  className="rounded-[24px] border p-4 text-left transition hover:-translate-y-0.5"
                  style={{
                    borderColor: isActive ? theme.palette.accent : preview.border,
                    backgroundColor: isActive ? theme.palette.surfaceAlt : preview.surface,
                    boxShadow: isActive
                      ? `0 18px 40px ${theme.palette.primary}1A`
                      : "0 12px 30px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: theme.palette.text }}>
                        {theme.name}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: theme.palette.muted }}>
                        {theme.description}
                      </p>
                    </div>

                    {isActive && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{
                          backgroundColor: theme.palette.accentSoft || theme.palette.surface,
                          color: theme.palette.accentDeep,
                        }}
                      >
                        Activa
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <ThemeSwatches
                      palette={theme.palette}
                      borderColor={`${theme.palette.border}CC`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border p-6" style={{ borderColor: preview.border }}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold" style={{ color: preview.text }}>
            Ajuste manual
          </h3>
          <p className="mt-1 text-sm" style={{ color: preview.muted }}>
            Si cambias un color a mano, el tema pasa a modo personalizado hasta que vuelvas a
            aplicar un preset.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_THEME_FIELDS.map((field) => (
            <label
              key={field.key}
              className="rounded-2xl border p-4"
              style={{ borderColor: preview.border }}
            >
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
                <p
                  className="text-xs uppercase tracking-[0.22em]"
                  style={{ color: preview.accentDeep }}
                >
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

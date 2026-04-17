import QuoteBuilderWorkspace from "../QuoteBuilderWorkspace";
import { adminTheme } from "../../theme/adminTheme";

function QuoteBuilderModal({ open, onClose, onSaved }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div
          className="flex items-center justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: adminTheme.border }}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: adminTheme.muted }}>
              Workspace Lab
            </p>
            <h2 className="mt-1 text-xl font-semibold" style={{ color: adminTheme.text }}>
              Nueva cotizacion
            </h2>
            <p className="mt-1 text-sm" style={{ color: adminTheme.muted }}>
              Crea la cotizacion sin salir del lab y abre el registro apenas se guarde.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: adminTheme.border, color: adminTheme.text }}
          >
            Cerrar
          </button>
        </div>

        <div
          className="overflow-y-auto px-6 py-5"
          style={{ backgroundColor: adminTheme.bg }}
        >
          <QuoteBuilderWorkspace quoteId="" onCancel={onClose} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

export default QuoteBuilderModal;

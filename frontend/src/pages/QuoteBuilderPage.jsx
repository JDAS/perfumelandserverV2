import { Link, useNavigate, useParams } from "react-router-dom";
import QuoteBuilderWorkspace from "../components/QuoteBuilderWorkspace";

export default function QuoteBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Cotizaciones / Calculadora</p>
          <h1 className="text-3xl font-bold">
            {isEditMode ? "Editar cotizacion" : "Nueva cotizacion"}
          </h1>
        </div>

        <div className="flex gap-3">
          <Link to="/admin?tab=quote" className="rounded bg-gray-200 px-4 py-2">
            Volver
          </Link>
        </div>
      </div>

      <QuoteBuilderWorkspace
        quoteId={id || ""}
        onSaved={({ quoteId }) => navigate(`/admin/quote/${quoteId}/view?tab=quote`)}
        onConverted={({ saleId }) => navigate(`/admin/sales/${saleId}/view?tab=sales`)}
      />
    </div>
  );
}

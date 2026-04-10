import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import {
  convertQuoteToSale,
  getClientSummary,
  getRecordById,
} from "../services/customService";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import {
  formatFieldValue,
  getBackToListSearch,
  isBlankBlock,
  splitFieldsIntoColumns,
} from "../engine/metadataEngine";
import RelatedListSection from "../components/RelatedListSection";
import ClientSummaryModal from "../components/ClientSummaryModal";
import { useToast } from "../components/ui/ToastContext";

function RecordDetailPage() {
  const { object, id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getObjectByApiNameFromCache } = useObjectMetadata();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const [converting, setConverting] = useState(false);
  const { addToast } = useToast();

  const objectDef = getObjectByApiNameFromCache(object);
  const backToListQuery = getBackToListSearch(searchParams, object);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const recordData = await getRecordById(object, id);
        setRecord(recordData);
      } catch (error) {
        console.error("Error cargando detalle del registro:", error);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [object, id]);

  const getFieldByApiName = (apiName) =>
    (objectDef?.fields || []).find((field) => field.apiName === apiName);

  const renderFieldValue = (field) => {
    return formatFieldValue(field, record?.[field.apiName], record);
  };

  const renderFieldOrBlank = (item, index) => {
    if (isBlankBlock(item)) {
      return (
        <div
          key={`${item}-${index}`}
          className="h-[72px] rounded border-2 border-dashed border-gray-200 bg-gray-50"
        />
      );
    }

    const field = getFieldByApiName(item);
    if (!field || field.visibleInDetail === false) return null;

    return (
      <div key={field.apiName} className="mb-4">
        <label className="block mb-1 text-sm font-medium text-gray-600">
          {field.label}
        </label>
        <div className="w-full rounded border bg-gray-50 p-3 min-h-[46px]">
          {renderFieldValue(field)}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-10">Cargando...</div>;

  if (!objectDef || !record) {
    return (
      <div className="p-10">
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold mb-3">Registro no encontrado</h1>
          <button
            onClick={() => navigate(`/admin?${backToListQuery}`)}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const activeLayout = objectDef.layout?.[0];
  const fieldSections = (activeLayout?.sections || []).filter(
    (section) => section.type !== "relatedList"
  );
  const relatedSections = (activeLayout?.sections || []).filter(
    (section) => section.type === "relatedList"
  );
  const supportsClientSummary = object === "sales" || object === "quote";
  const supportsQuoteConversion = object === "quote";

  const handleOpenSummary = async () => {
    try {
      const data = await getClientSummary(object, id);
      setSummary(data);
      setSummaryOpen(true);
    } catch (error) {
      console.error(error);
      addToast("No se pudo generar el resumen", "error");
    }
  };

  const handleCopySummary = async () => {
    if (!summary?.whatsappText) return;
    try {
      setCopying(true);
      await navigator.clipboard.writeText(summary.whatsappText);
      addToast("Resumen copiado al portapapeles", "success");
    } catch (error) {
      console.error(error);
      addToast("No se pudo copiar el resumen", "error");
    } finally {
      setCopying(false);
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!summary?.whatsappText) return;

    try {
      setOpeningWhatsApp(true);
      const encoded = encodeURIComponent(summary.whatsappText);
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      addToast("No se pudo abrir WhatsApp", "error");
    } finally {
      setOpeningWhatsApp(false);
    }
  };

  const handleConvertQuote = async () => {
    if (!record?._id) return;

    if (record.status === "Convertida") {
      addToast("Esta cotizacion ya fue convertida", "warning");
      return;
    }

    if (!window.confirm("¿Convertir esta cotizacion en una venta borrador?")) {
      return;
    }

    try {
      setConverting(true);
      const result = await convertQuoteToSale(record._id);
      addToast("Cotizacion convertida en venta", "success");
      navigate(`/admin/sales/${result.saleId}/view?tab=sales`);
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.error || "No se pudo convertir la cotizacion",
        "error"
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            {objectDef.name} / Detalle de registro
          </p>
          <h1 className="text-3xl font-bold">{objectDef.name}</h1>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/admin?${backToListQuery}`)}
            className="bg-gray-200 text-black px-4 py-2 rounded"
          >
            Volver
          </button>
          {supportsClientSummary ? (
            <button
              type="button"
              onClick={handleOpenSummary}
              className="bg-emerald-600 px-4 py-2 rounded text-white"
            >
              Resumen cliente
            </button>
          ) : null}
          {supportsQuoteConversion ? (
            <button
              type="button"
              onClick={handleConvertQuote}
              disabled={converting || record.status === "Convertida"}
              className="bg-violet-600 px-4 py-2 rounded text-white disabled:opacity-60"
            >
              {record.status === "Convertida"
                ? "Cotizacion convertida"
                : converting
                  ? "Convirtiendo..."
                  : "Convertir a venta"}
            </button>
          ) : null}

          <Link
            to={`/admin/${objectDef.apiName}/${record._id}?${backToListQuery}&returnTo=detail`}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Editar
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">ID:</span> {record._id}
          </div>
          <div>
            <span className="font-medium">Creado:</span>{" "}
            {record.createdAt ? new Date(record.createdAt).toLocaleString() : "-"}
          </div>
          <div>
            <span className="font-medium">Actualizado:</span>{" "}
            {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "-"}
          </div>
        </div>
      </div>

      {fieldSections.length > 0 ? (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="space-y-8">
            {fieldSections.map((section, idx) => {
              const sectionFields = section.fields || [];
              const { col1, col2 } = splitFieldsIntoColumns(sectionFields);
              const hasLabel = Boolean(String(section.label || "").trim());

              return (
                <div
                  key={`${section.apiName || "section"}-${idx}`}
                  className={idx > 0 ? "border-t pt-6" : ""}
                >
                  {hasLabel && (
                    <h2 className="font-bold mb-4 text-lg">{section.label}</h2>
                  )}

                  {section.columns === 2 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>{col1.map((item, index) => renderFieldOrBlank(item, index))}</div>
                      <div>{col2.map((item, index) => renderFieldOrBlank(item, index))}</div>
                    </div>
                  ) : (
                    <div>
                      {sectionFields.map((item, index) =>
                        renderFieldOrBlank(item, index)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-6">
          {(objectDef.fields || [])
            .filter((field) => field.visibleInDetail !== false)
            .map((field) => (
              <div key={field.apiName} className="mb-4">
                <label className="block mb-1 text-sm font-medium text-gray-600">
                  {field.label}
                </label>
                <div className="w-full rounded border bg-gray-50 p-3 min-h-[46px]">
                  {renderFieldValue(field)}
                </div>
              </div>
            ))}
        </div>
      )}

      {relatedSections.map((section, idx) => (
        <RelatedListSection
          key={`${section.apiName || "related"}-${idx}`}
          parentObject={object}
          parentId={id}
          section={section}
        />
      ))}

      <ClientSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        onCopy={handleCopySummary}
        onOpenWhatsApp={handleOpenWhatsApp}
        copying={copying}
        openingWhatsApp={openingWhatsApp}
      />
    </div>
  );
}

export default RecordDetailPage;

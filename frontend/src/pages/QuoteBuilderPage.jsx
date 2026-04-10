import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ClientSummaryModal from "../components/ClientSummaryModal";
import {
  createRecord,
  deleteRecord,
  getClientSummary,
  getRecordById,
  getRecords,
  getRelatedRecords,
  updateRecord,
} from "../services/customService";
import { calculatePayments, formatCRC } from "../utils/paymentCalculator";
import { useToast } from "../components/ui/ToastContext";

function defaultItem() {
  return {
    _id: "",
    product: "",
    quantity: 1,
    price: 0,
    list_price: 0,
    discount: 0,
  };
}

export default function QuoteBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [quote, setQuote] = useState({
    name: "",
    quote_date: new Date().toISOString().slice(0, 10),
    status: "Borrador",
    type: "Contado",
    credittype: "Normal",
    seller_id: "",
    quotes: 1,
  });
  const [items, setItems] = useState([defaultItem()]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const [productData, sellerData] = await Promise.all([
          getRecords("product", { limit: 500, sortBy: "name", sortOrder: "asc" }),
          getRecords("seller", { limit: 200, sortBy: "name", sortOrder: "asc" }),
        ]);

        if (cancelled) return;

        setProducts(productData.records || []);
        setSellers(sellerData.records || []);

        if (isEditMode) {
          const [quoteRecord, relatedItems] = await Promise.all([
            getRecordById("quote", id),
            getRelatedRecords("quote", id, "quote_item", "quote"),
          ]);

          if (cancelled) return;

          setQuote((prev) => ({
            ...prev,
            name: quoteRecord.name || "",
            quote_date: quoteRecord.quote_date || prev.quote_date,
            status: quoteRecord.status || "Borrador",
            type: quoteRecord.type || "Contado",
            credittype: quoteRecord.credittype || "Normal",
            seller_id: quoteRecord.seller_id || "",
            quotes: Number(quoteRecord.quotes) || 1,
          }));

          const nextItems = (relatedItems.records || []).map((item) => ({
            _id: item._id,
            product: item.product || "",
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            list_price: Number(item.list_price) || 0,
            discount: Number(item.discount) || 0,
          }));

          setItems(nextItems.length ? nextItems : [defaultItem()]);
        }
      } catch (error) {
        console.error(error);
        addToast("No se pudo cargar la cotizacion", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [id, isEditMode, addToast]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [String(product._id), product])),
    [products]
  );

  const computedItems = useMemo(
    () =>
      items.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const discount = Number(item.discount) || 0;
        const subtotal = quantity * price;
        const total = subtotal - discount;
        return { ...item, quantity, price, discount, subtotal, total };
      }),
    [items]
  );

  const cashTotal = useMemo(
    () => computedItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    [computedItems]
  );

  const paymentPreview = useMemo(
    () =>
      calculatePayments({
        total: cashTotal,
        type: quote.type,
        creditType: quote.credittype,
        quotes: quote.quotes,
        salesDate: quote.quote_date,
      }),
    [cashTotal, quote]
  );

  const updateItem = (index, changes) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item))
    );
  };

  const handleProductChange = (index, productId) => {
    const selectedProduct = productMap.get(String(productId));
    const basePrice = Number(selectedProduct?.price) || 0;
    const adjustedPrice = quote.type === "Credito" && selectedProduct ? basePrice + 5000 : basePrice;

    updateItem(index, {
      product: productId,
      list_price: adjustedPrice,
      price: adjustedPrice,
    });
  };

  const handleAddItem = () => setItems((prev) => [...prev, defaultItem()]);
  const handleRemoveItem = (index) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleSave = async () => {
    const validItems = computedItems.filter((item) => item.product);
    if (!validItems.length) {
      addToast("Agrega al menos un perfume a la cotizacion", "warning");
      return;
    }

    try {
      setSaving(true);

      const quotePayload = {
        name: quote.name,
        quote_date: quote.quote_date,
        status: quote.status,
        type: quote.type,
        credittype: quote.credittype,
        seller_id: quote.seller_id || "",
        quotes: Number(quote.quotes) || 1,
      };

      let quoteId = id;
      if (isEditMode) {
        await updateRecord("quote", id, quotePayload);
      } else {
        const response = await createRecord("quote", quotePayload);
        quoteId = response?.record?._id;
      }

      if (isEditMode) {
        const currentRelated = await getRelatedRecords("quote", quoteId, "quote_item", "quote");
        const currentIds = (currentRelated.records || []).map((item) => String(item._id));
        const nextIds = new Set(validItems.map((item) => String(item._id || "")).filter(Boolean));
        const idsToDelete = currentIds.filter((currentId) => !nextIds.has(currentId));
        await Promise.all(idsToDelete.map((currentId) => deleteRecord("quote_item", currentId)));
      }

      await Promise.all(
        validItems.map((item) => {
          const payload = {
            quote: quoteId,
            product: item.product,
            quantity: item.quantity,
            price: item.price,
            list_price: item.list_price || item.price,
            discount: item.discount || 0,
          };

          return item._id
            ? updateRecord("quote_item", item._id, payload)
            : createRecord("quote_item", payload);
        })
      );

      addToast("Cotizacion guardada", "success");
      navigate(`/admin/quote/${quoteId}/view?tab=quote`);
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo guardar la cotizacion", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSummary = async () => {
    try {
      if (!id) {
        addToast("Guarda la cotizacion antes de generar el resumen", "warning");
        return;
      }
      const data = await getClientSummary("quote", id);
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

  if (loading) return <div className="p-10">Cargando cotizacion...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Cotizaciones / Calculadora</p>
          <h1 className="text-3xl font-bold">{isEditMode ? "Editar cotizacion" : "Nueva cotizacion"}</h1>
        </div>

        <div className="flex gap-3">
          <Link to="/admin?tab=quote" className="rounded bg-gray-200 px-4 py-2">
            Volver
          </Link>
          {isEditMode ? (
            <button type="button" onClick={handleOpenSummary} className="rounded bg-emerald-600 px-4 py-2 text-white">
              Resumen cliente
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6 rounded-2xl bg-white p-6 shadow">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Cliente</label>
              <input className="w-full rounded-lg border p-3" value={quote.name} onChange={(e) => setQuote((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha</label>
              <input type="date" className="w-full rounded-lg border p-3" value={quote.quote_date} onChange={(e) => setQuote((prev) => ({ ...prev, quote_date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select className="w-full rounded-lg border p-3" value={quote.type} onChange={(e) => setQuote((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="Contado">Contado</option>
                <option value="Credito">Credito</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vendedor</label>
              <select className="w-full rounded-lg border p-3" value={quote.seller_id} onChange={(e) => setQuote((prev) => ({ ...prev, seller_id: e.target.value }))}>
                <option value="">Sin vendedor</option>
                {sellers.map((seller) => (
                  <option key={seller._id} value={seller._id}>{seller.name}</option>
                ))}
              </select>
            </div>
            {quote.type === "Credito" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Tipo de credito</label>
                  <select className="w-full rounded-lg border p-3" value={quote.credittype} onChange={(e) => setQuote((prev) => ({ ...prev, credittype: e.target.value }))}>
                    <option value="Normal">Normal</option>
                    <option value="Dos pagos">Dos pagos</option>
                    <option value="Extendido">Extendido</option>
                    <option value="Extendido especial">Extendido especial</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Cuotas</label>
                  <input type="number" min={1} className="w-full rounded-lg border p-3" value={quote.quotes} onChange={(e) => setQuote((prev) => ({ ...prev, quotes: Number(e.target.value) || 1 }))} />
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Perfumes</h2>
              <button type="button" onClick={handleAddItem} className="rounded bg-black px-4 py-2 text-white">
                Agregar perfume
              </button>
            </div>

            {computedItems.map((item, index) => (
              <div key={`quote-item-${item._id || index}`} className="rounded-xl border p-4">
                <div className="grid gap-3 md:grid-cols-[1.7fr_0.8fr_0.8fr_0.8fr_auto]">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Producto</label>
                    <select className="w-full rounded-lg border p-3" value={item.product} onChange={(e) => handleProductChange(index, e.target.value)}>
                      <option value="">Selecciona un perfume</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>{product.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Cantidad</label>
                    <input type="number" min={1} className="w-full rounded-lg border p-3" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Precio</label>
                    <input type="number" className="w-full rounded-lg border p-3" value={item.price} onChange={(e) => updateItem(index, { price: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Descuento</label>
                    <input type="number" className="w-full rounded-lg border p-3" value={item.discount} onChange={(e) => updateItem(index, { discount: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={() => handleRemoveItem(index)} className="w-full rounded bg-red-600 px-4 py-3 text-white">
                      Quitar
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-500">Lista</p>
                    <p className="mt-1 font-semibold">{formatCRC(item.list_price || item.price)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-500">Subtotal</p>
                    <p className="mt-1 font-semibold">{formatCRC(item.subtotal)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-500">Total</p>
                    <p className="mt-1 font-semibold">{formatCRC(item.total)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl bg-white p-6 shadow">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Resumen</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{formatCRC(cashTotal)}</p>
            <p className="mt-2 text-sm text-gray-500">Total al contado de la cotizacion actual.</p>
          </div>

          {quote.type === "Credito" ? (
            <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Vista de credito</p>
              <div className="space-y-2 text-sm text-gray-700">
                {paymentPreview.map((payment) => (
                  <div key={`preview-${payment.number}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                    <span>Cuota {payment.number}</span>
                    <span>{payment.fecha}</span>
                    <strong>{formatCRC(payment.expectedAmount)}</strong>
                  </div>
                ))}
                {paymentPreview.length === 0 ? <p className="text-sm text-gray-500">No hay cuotas calculadas.</p> : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-black px-4 py-3 text-white disabled:opacity-60">
              {saving ? "Guardando..." : "Guardar cotizacion"}
            </button>
            {isEditMode ? (
              <button type="button" onClick={handleOpenSummary} className="rounded-lg bg-emerald-600 px-4 py-3 text-white">
                Generar resumen para cliente
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <ClientSummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} summary={summary} onCopy={handleCopySummary} copying={copying} />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import ClientSummaryModal from "./ClientSummaryModal";
import LookupField from "./fields/LookupField";
import { useToast } from "./ui/ToastContext";
import {
  convertQuoteToSale,
  createRecord,
  deleteRecord,
  getClientSummary,
  getRecordById,
  getRecords,
  getRelatedRecords,
  updateRecord,
} from "../services/customService";
import { calculatePayments, formatCRC } from "../utils/paymentCalculator";

function defaultItem() {
  return {
    _id: "",
    entry_mode: "catalog",
    product: "",
    product_name: "",
    manual_product_name: "",
    pending_catalog_completion: false,
    quantity: 1,
    price: 0,
    list_price: 0,
    discount: 0,
    discount_scope: "Sin descuento",
    discount_reason: "",
  };
}

function normalizeDiscountScope(value = "", discount = 0) {
  if (
    value === "Sin descuento" ||
    value === "Solo contado" ||
    value === "Solo credito" ||
    value === "Ambos"
  ) {
    return value;
  }

  return Number(discount) > 0 ? "Ambos" : "Sin descuento";
}

function getDiscountForScope(scope, discount, type) {
  const normalizedDiscount = Math.max(Number(discount) || 0, 0);
  const normalizedType = type === "Credito" ? "Credito" : "Contado";
  const normalizedScope = normalizeDiscountScope(scope, normalizedDiscount);

  if (normalizedScope === "Sin descuento" || normalizedDiscount <= 0) return 0;
  if (normalizedScope === "Ambos") return normalizedDiscount;
  if (normalizedScope === "Solo contado") {
    return normalizedType === "Contado" ? normalizedDiscount : 0;
  }
  if (normalizedScope === "Solo credito") {
    return normalizedType === "Credito" ? normalizedDiscount : 0;
  }

  return 0;
}

function getCreditAdjustedPrice(basePrice, type) {
  const numericBasePrice = Number(basePrice) || 0;
  if (type !== "Credito") return numericBasePrice;
  return numericBasePrice + (numericBasePrice <= 25000 ? 3000 : 5000);
}

export default function QuoteBuilderWorkspace({
  quoteId = "",
  onCancel,
  onSaved,
  onConverted,
  compact = false,
}) {
  const { addToast } = useToast();
  const isEditMode = Boolean(quoteId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const sellerData = await getRecords("seller", {
          limit: 200,
          sortBy: "name",
          sortOrder: "asc",
        });

        if (cancelled) return;

        setSellers(sellerData.records || []);

        if (isEditMode) {
          const [quoteRecord, relatedItems] = await Promise.all([
            getRecordById("quote", quoteId),
            getRelatedRecords("quote", quoteId, "quote_item", "quote"),
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
            entry_mode:
              !item.product && String(item.manual_product_name || "").trim() ? "manual" : "catalog",
            product: item.product || "",
            product_name: item._lookup?.product?.label || item.product_name || "",
            manual_product_name: item.manual_product_name || "",
            pending_catalog_completion:
              item.pending_catalog_completion === true ||
              (!item.product && Boolean(String(item.manual_product_name || "").trim())),
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            list_price: Number(item.list_price) || 0,
            discount: Number(item.discount) || 0,
            discount_scope: normalizeDiscountScope(item.discount_scope, item.discount),
            discount_reason: item.discount_reason || "",
          }));

          setItems(nextItems.length ? nextItems : [defaultItem()]);
        } else {
          setQuote({
            name: "",
            quote_date: new Date().toISOString().slice(0, 10),
            status: "Borrador",
            type: "Contado",
            credittype: "Normal",
            seller_id: "",
            quotes: 1,
          });
          setItems([defaultItem()]);
        }
      } catch (error) {
        console.error(error);
        addToast("No se pudo cargar la cotizacion", "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [quoteId, isEditMode, addToast]);

  const computedItems = useMemo(
    () =>
      items.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const listPrice = Number(item.list_price) || price;
        const discount = Number(item.discount) || 0;
        const discountScope = normalizeDiscountScope(item.discount_scope, discount);
        const subtotal = quantity * price;
        const cashSubtotal = quantity * listPrice;
        const cashDiscount = getDiscountForScope(discountScope, discount, "Contado");
        const creditDiscount = getDiscountForScope(discountScope, discount, "Credito");
        const total = Math.max(subtotal - getDiscountForScope(discountScope, discount, quote.type), 0);
        return {
          ...item,
          entry_mode:
            item.entry_mode === "manual" ||
            (!item.product && String(item.manual_product_name || "").trim())
              ? "manual"
              : "catalog",
          manual_product_name: String(item.manual_product_name || "").trim(),
          pending_catalog_completion:
            item.entry_mode === "manual" ||
            item.pending_catalog_completion === true ||
            (!item.product && String(item.manual_product_name || "").trim()),
          quantity,
          price,
          list_price: listPrice,
          discount,
          discount_scope: discountScope,
          discount_reason: String(item.discount_reason || "").trim(),
          subtotal,
          cashSubtotal,
          cashDiscount,
          creditDiscount,
          total,
        };
      }),
    [items, quote.type]
  );

  const cashTotal = useMemo(
    () =>
      computedItems.reduce((sum, item) => {
        return sum + Math.max(item.cashSubtotal - item.cashDiscount, 0);
      }, 0),
    [computedItems]
  );

  const creditTotal = useMemo(
    () =>
      computedItems.reduce((sum, item) => {
        const creditUnitPrice =
          quote.type === "Credito"
            ? Number(item.price) || 0
            : getCreditAdjustedPrice(Number(item.list_price) || Number(item.price) || 0, "Credito");
        const creditSubtotal = creditUnitPrice * item.quantity;
        return sum + Math.max(creditSubtotal - item.creditDiscount, 0);
      }, 0),
    [computedItems, quote.type]
  );

  const paymentPreview = useMemo(
    () =>
      calculatePayments({
        total: creditTotal,
        type: quote.type,
        creditType: quote.credittype,
        quotes: quote.quotes,
        salesDate: quote.quote_date,
      }),
    [creditTotal, quote]
  );

  const updateItem = (index, changes) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item))
    );
  };

  const setItemMode = (index, mode) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (mode === "manual") {
          return {
            ...item,
            entry_mode: "manual",
            product: "",
            product_name: "",
            pending_catalog_completion: true,
          };
        }

        return {
          ...item,
          entry_mode: "catalog",
          manual_product_name: "",
          pending_catalog_completion: false,
        };
      })
    );
  };

  const handleProductChange = (index, selectedProduct) => {
    const basePrice = Number(selectedProduct?.price) || 0;
    const adjustedPrice = selectedProduct
      ? getCreditAdjustedPrice(basePrice, quote.type)
      : basePrice;

    updateItem(index, {
      entry_mode: "catalog",
      product: selectedProduct?._id || "",
      product_name: selectedProduct?.name || "",
      manual_product_name: "",
      pending_catalog_completion: false,
      list_price: basePrice,
      price: adjustedPrice,
    });
  };

  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => {
        const basePrice = Number(item.list_price) || Number(item.price) || 0;
        return {
          ...item,
          price: getCreditAdjustedPrice(basePrice, quote.type),
        };
      })
    );
  }, [quote.type]);

  const handleAddItem = () => setItems((prev) => [...prev, defaultItem()]);
  const handleRemoveItem = (index) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)));

  const handleSave = async () => {
    const validItems = computedItems.filter(
      (item) => item.product || String(item.manual_product_name || "").trim()
    );
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

      let nextQuoteId = quoteId;
      let savedRecord = null;

      if (isEditMode) {
        await updateRecord("quote", quoteId, quotePayload);
      } else {
        const response = await createRecord("quote", quotePayload);
        nextQuoteId = response?.record?._id;
        savedRecord = response?.record || null;
      }

      if (!nextQuoteId) {
        throw new Error("No se pudo identificar la cotizacion guardada");
      }

      if (isEditMode) {
        const currentRelated = await getRelatedRecords("quote", nextQuoteId, "quote_item", "quote");
        const currentIds = (currentRelated.records || []).map((item) => String(item._id));
        const nextIds = new Set(validItems.map((item) => String(item._id || "")).filter(Boolean));
        const idsToDelete = currentIds.filter((currentId) => !nextIds.has(currentId));
        await Promise.all(idsToDelete.map((currentId) => deleteRecord("quote_item", currentId)));
      }

      await Promise.all(
        validItems.map((item) => {
          const manualName = String(item.manual_product_name || "").trim();
          const isManualItem = !item.product && Boolean(manualName);
          const payload = {
            quote: nextQuoteId,
            product: item.product || "",
            manual_product_name: isManualItem ? manualName : "",
            pending_catalog_completion: isManualItem,
            quantity: item.quantity,
            price: item.price,
            list_price: item.list_price || item.price,
            discount: item.discount || 0,
            discount_scope: normalizeDiscountScope(item.discount_scope, item.discount),
            discount_reason: String(item.discount_reason || "").trim(),
          };

          return item._id
            ? updateRecord("quote_item", item._id, payload)
            : createRecord("quote_item", payload);
        })
      );

      if (!savedRecord) {
        try {
          savedRecord = await getRecordById("quote", nextQuoteId);
        } catch {
          savedRecord = { _id: nextQuoteId, ...quotePayload };
        }
      }

      addToast("Cotizacion guardada", "success");
      await onSaved?.({
        quoteId: nextQuoteId,
        record: savedRecord,
        isEditMode,
      });
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo guardar la cotizacion", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSummary = async () => {
    try {
      if (!quoteId) {
        addToast("Guarda la cotizacion antes de generar el resumen", "warning");
        return;
      }

      const data = await getClientSummary("quote", quoteId);
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

  const handleConvertToSale = async () => {
    if (!quoteId) {
      addToast("Guarda la cotizacion antes de convertirla", "warning");
      return;
    }

    if (quote.status === "Convertida") {
      addToast("Esta cotizacion ya fue convertida", "warning");
      return;
    }

    if (!window.confirm("¿Convertir esta cotizacion en una venta borrador?")) {
      return;
    }

    try {
      setConverting(true);
      const result = await convertQuoteToSale(quoteId);
      setQuote((prev) => ({ ...prev, status: "Convertida" }));
      addToast("Cotizacion convertida en venta", "success");
      await onConverted?.(result);
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "No se pudo convertir la cotizacion", "error");
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return <div className="p-10">Cargando cotizacion...</div>;
  }

  return (
    <>
      <div className={compact ? "space-y-4" : "grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"}>
        <section
          className={
            compact
              ? "space-y-4 bg-white"
              : "space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
          }
        >
          <div className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}>
            <div>
              <label className="mb-1 block text-sm font-medium">Cliente</label>
              <input
                className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                value={quote.name}
                onChange={(event) =>
                  setQuote((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Fecha</label>
              <input
                type="date"
                className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                value={quote.quote_date}
                onChange={(event) =>
                  setQuote((prev) => ({ ...prev, quote_date: event.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select
                className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                value={quote.type}
                onChange={(event) =>
                  setQuote((prev) => ({ ...prev, type: event.target.value }))
                }
              >
                <option value="Contado">Contado</option>
                <option value="Credito">Credito</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Vendedor</label>
              <select
                className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                value={quote.seller_id}
                onChange={(event) =>
                  setQuote((prev) => ({ ...prev, seller_id: event.target.value }))
                }
              >
                <option value="">Sin vendedor</option>
                {sellers.map((seller) => (
                  <option key={seller._id} value={seller._id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </div>

            {quote.type === "Credito" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Tipo de credito</label>
                  <select
                    className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                    value={quote.credittype}
                    onChange={(event) =>
                      setQuote((prev) => ({ ...prev, credittype: event.target.value }))
                    }
                  >
                    <option value="Normal">Normal</option>
                    <option value="Dos pagos">Dos pagos</option>
                    <option value="Extendido">Extendido</option>
                    <option value="Extendido especial">Extendido especial</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Cuotas</label>
                  <input
                    type="number"
                    min={1}
                    className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                    value={quote.quotes}
                    onChange={(event) =>
                      setQuote((prev) => ({
                        ...prev,
                        quotes: Number(event.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className={compact ? "space-y-3" : "space-y-4"}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={compact ? "text-lg font-black" : "text-xl font-bold"}>Perfumes</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className={
                  compact
                    ? "rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white"
                    : "rounded bg-black px-4 py-2 text-white"
                }
              >
                {compact ? "Agregar" : "Agregar perfume"}
              </button>
            </div>

            {computedItems.map((item, index) => (
              <div
                key={`quote-item-${item._id || index}`}
                className={compact ? "rounded-2xl border p-3" : "rounded-xl border p-4"}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Tipo de item
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemMode(index, "catalog")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      item.entry_mode !== "manual"
                        ? "bg-slate-900 text-white"
                        : "border bg-white text-slate-700"
                    }`}
                  >
                    Catalogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemMode(index, "manual")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      item.entry_mode === "manual"
                        ? "bg-amber-600 text-white"
                        : "border bg-white text-slate-700"
                    }`}
                  >
                    Manual
                  </button>
                  {item.entry_mode === "manual" ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Pendiente de catalogo
                    </span>
                  ) : null}
                </div>

                <div className={compact ? "grid gap-3" : "grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_0.85fr_0.95fr_auto]"}>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {item.entry_mode === "manual" ? "Nombre del perfume" : "Producto"}
                    </label>
                    {item.entry_mode === "manual" ? (
                      <input
                        type="text"
                        className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                        value={item.manual_product_name || ""}
                        placeholder="Ej. Baccarat Rouge 540"
                        onChange={(event) =>
                          updateItem(index, {
                            manual_product_name: event.target.value,
                            pending_catalog_completion: Boolean(event.target.value.trim()),
                          })
                        }
                      />
                    ) : (
                      <LookupField
                        field={{
                          apiName: "product",
                          label: "Producto",
                          type: "lookup",
                          referenceTo: "product",
                          lookupFilters: [{ field: "isactive", operator: "eq", value: true }],
                        }}
                        value={item.product}
                        onChange={(productId) =>
                          updateItem(index, {
                            product: productId,
                            product_name: productId ? item.product_name : "",
                          })
                        }
                        onSelect={(selectedProduct) => handleProductChange(index, selectedProduct)}
                        formData={{}}
                      />
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, {
                          quantity: Number(event.target.value) || 1,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {item.entry_mode === "manual" ? "Precio contado" : "Precio"}
                    </label>
                    <input
                      type="number"
                      className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                      value={item.entry_mode === "manual" ? item.list_price : item.price}
                      onChange={(event) =>
                        item.entry_mode === "manual"
                          ? updateItem(index, {
                              list_price: Number(event.target.value) || 0,
                              price:
                                quote.type === "Credito"
                                  ? getCreditAdjustedPrice(
                                      Number(event.target.value) || 0,
                                      "Credito"
                                    )
                                  : Number(event.target.value) || 0,
                            })
                          : updateItem(index, { price: Number(event.target.value) || 0 })
                      }
                    />
                  </div>

                  <div className="flex items-end xl:justify-end">
                    {!compact ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-full rounded bg-red-600 px-4 py-3 text-white xl:w-auto"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={compact ? "mt-3 grid gap-3" : "mt-3 grid gap-3 xl:grid-cols-[0.9fr_1fr_minmax(0,1.5fr)]"}>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Descuento</label>
                    <input
                      type="number"
                      className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                      value={item.discount}
                      onChange={(event) =>
                        updateItem(index, { discount: Number(event.target.value) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Aplica a</label>
                    <select
                      className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                      value={item.discount_scope}
                      onChange={(event) =>
                        updateItem(index, { discount_scope: event.target.value })
                      }
                    >
                      <option value="Sin descuento">Sin descuento</option>
                      <option value="Ambos">Ambos</option>
                      <option value="Solo contado">Solo contado</option>
                      <option value="Solo credito">Solo credito</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Motivo</label>
                    <input
                      type="text"
                      className={`w-full rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
                      value={item.discount_reason || ""}
                      placeholder="Combo, promocion, cliente frecuente..."
                      onChange={(event) =>
                        updateItem(index, { discount_reason: event.target.value })
                      }
                    />
                  </div>
                </div>

                <div className={compact ? "mt-3 grid grid-cols-3 gap-2" : "mt-3 grid gap-3 md:grid-cols-3"}>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-500">Contado</p>
                    <p className="mt-1 font-semibold">
                      {formatCRC(Math.max(item.cashSubtotal - item.cashDiscount, 0))}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-500">
                      {quote.type === "Credito" ? "Credito" : "Subtotal"}
                    </p>
                    <p className="mt-1 font-semibold">{formatCRC(item.subtotal)}</p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-500">Total</p>
                    <p className="mt-1 font-semibold">{formatCRC(item.total)}</p>
                  </div>
                </div>

                {item.discount > 0 ? (
                  <p className="mt-3 text-sm text-gray-500">
                    {item.discount_scope === "Sin descuento"
                      ? `Hay un descuento configurado de ${formatCRC(item.discount)}, pero no se aplica todavia.`
                      : `Descuento de ${formatCRC(item.discount)} aplicado a ${
                          item.discount_scope === "Ambos"
                            ? "contado y credito"
                            : item.discount_scope === "Solo contado"
                              ? "contado"
                              : "credito"
                        }${item.discount_reason ? ` por ${item.discount_reason}.` : "."}`}
                  </p>
                ) : null}

                {item.entry_mode === "manual" ? (
                  <p className="mt-3 text-sm text-amber-700">
                    Este perfume se guardara como pendiente de catalogo. La cotizacion podra
                    resumirse, pero no convertirse en venta hasta vincularlo a un producto activo.
                  </p>
                ) : null}

                {compact ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Quitar perfume
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <aside className={compact ? "space-y-3 rounded-2xl border bg-white p-4 shadow-sm" : "space-y-4 rounded-2xl border bg-white p-6 shadow-sm"}>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Resumen</p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Contado</p>
                <p className={compact ? "mt-2 text-xl font-bold text-gray-900" : "mt-2 text-2xl font-bold text-gray-900"}>{formatCRC(cashTotal)}</p>
              </div>

              {quote.type === "Credito" ? (
                <div className="rounded-xl border bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Credito</p>
                  <p className={compact ? "mt-2 text-xl font-bold text-gray-900" : "mt-2 text-2xl font-bold text-gray-900"}>
                    {formatCRC(creditTotal)}
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {quote.type === "Credito"
                ? "La cotizacion muestra ambos montos: contado y credito."
                : "Total al contado de la cotizacion actual."}
            </p>
          </div>

          {quote.type === "Credito" ? (
            <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Vista de credito</p>
              <div className="space-y-2 text-sm text-gray-700">
                {paymentPreview.map((payment) => (
                  <div
                    key={`preview-${payment.number}`}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                  >
                    <span>Cuota {payment.number}</span>
                    <span>{payment.fecha}</span>
                    <strong>{formatCRC(payment.expectedAmount)}</strong>
                  </div>
                ))}
                {paymentPreview.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay cuotas calculadas.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-black px-4 py-3 text-white disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cotizacion"}
            </button>

            {isEditMode ? (
              <button
                type="button"
                onClick={handleConvertToSale}
                disabled={converting || quote.status === "Convertida"}
                className="rounded-lg bg-violet-600 px-4 py-3 text-white disabled:opacity-60"
              >
                {quote.status === "Convertida"
                  ? "Cotizacion ya convertida"
                  : converting
                    ? "Convirtiendo a venta..."
                    : "Convertir a venta"}
              </button>
            ) : null}

            {isEditMode ? (
              <button
                type="button"
                onClick={handleOpenSummary}
                className="rounded-lg bg-emerald-600 px-4 py-3 text-white"
              >
                Generar resumen para cliente
              </button>
            ) : null}

            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border px-4 py-3 text-gray-700"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <ClientSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        onCopy={handleCopySummary}
        onOpenWhatsApp={handleOpenWhatsApp}
        copying={copying}
        openingWhatsApp={openingWhatsApp}
      />
    </>
  );
}

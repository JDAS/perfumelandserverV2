export default function ClientSummaryModal({
  open,
  onClose,
  summary,
  onCopy,
  onOpenWhatsApp,
  copying = false,
  openingWhatsApp = false,
}) {
  if (!open || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{summary.title || "Resumen para cliente"}</h2>
            {summary.customerName ? (
              <p className="mt-1 text-sm text-gray-500">{summary.customerName}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-2 text-sm">
            Cerrar
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="rounded-2xl border bg-gray-50 p-4">
            <ul className="space-y-2 text-sm text-gray-700">
              {(summary.products || []).map((product) => (
                <li key={product.id} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {product.name}
                      {product.quantity > 1 ? ` x${product.quantity}` : ""}
                    </p>
                    {product.discountAmount > 0 ? (
                      <p className="text-xs text-rose-600">
                        Descuento: {product.discountAmountFormatted || product.discountAmount}
                      </p>
                    ) : null}
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold text-gray-900">
                    {product.originalPriceFormatted || product.originalPrice}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {summary.numbers?.length ? (
              <div className="rounded-xl border p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Numeros</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {summary.numbers.join(", ")}
                </p>
              </div>
            ) : null}
            {summary.totalOriginalFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Total</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.totalOriginalFormatted}</p>
              </div>
            ) : null}
            {summary.totalDiscountsFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Descuentos</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.totalDiscountsFormatted}</p>
              </div>
            ) : null}
            {summary.totalSaleFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Total venta</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.totalSaleFormatted}</p>
              </div>
            ) : null}
            {summary.cashTotalFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Contado</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.cashTotalFormatted}</p>
              </div>
            ) : null}
            {summary.totalPaidFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Pagado</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.totalPaidFormatted}</p>
              </div>
            ) : null}
            {summary.balanceDueFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Pendiente</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.balanceDueFormatted}</p>
              </div>
            ) : null}
            {summary.overdueTotalFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-rose-500">En mora</p>
                <p className="mt-2 text-lg font-semibold text-rose-700">{summary.overdueTotalFormatted}</p>
              </div>
            ) : null}
            {summary.creditPreviewTotalFormatted ? (
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Credito</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{summary.creditPreviewTotalFormatted}</p>
              </div>
            ) : null}
          </div>

          {summary.overduePayments?.length || summary.nextPayment ? (
            <div className="grid gap-3 md:grid-cols-2">
              {summary.overduePayments?.length ? (
                <div className="rounded-2xl border bg-rose-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-rose-500">Cuotas vencidas</p>
                  <ul className="mt-3 space-y-2 text-sm text-rose-900">
                    {summary.overduePayments.map((payment) => (
                      <li key={payment.id}>
                        Cuota #{payment.number} / {payment.dueDate}, monto: {payment.pendingAmountFormatted}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {summary.nextPayment ? (
                <div className="rounded-2xl border bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-600">Proximo pago</p>
                  <p className="mt-3 text-sm font-semibold text-emerald-900">
                    Cuota #{summary.nextPayment.number} / {summary.nextPayment.dueDate}, monto: {summary.nextPayment.pendingAmountFormatted}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {summary.payments?.length ? (
            <div className="rounded-2xl border bg-white">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold text-gray-900">Vista de pagos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3">Cuota</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.payments.map((payment) => (
                      <tr key={`payment-preview-${payment.number}`} className="border-t">
                        <td className="px-4 py-3">{payment.number}</td>
                        <td className="px-4 py-3">{payment.fecha}</td>
                        <td className="px-4 py-3">{payment.expectedAmountFormatted || payment.expectedAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Texto para WhatsApp</p>
            <textarea readOnly value={summary.whatsappText || ""} rows={10} className="w-full rounded-xl border bg-gray-50 p-4 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-200 px-4 py-2">
            Cerrar
          </button>
          {onOpenWhatsApp ? (
            <button
              type="button"
              onClick={onOpenWhatsApp}
              disabled={openingWhatsApp}
              className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-60"
            >
              {openingWhatsApp ? "Abriendo..." : "Abrir WhatsApp"}
            </button>
          ) : null}
          <button type="button" onClick={onCopy} disabled={copying} className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-60">
            {copying ? "Copiando..." : "Copiar para WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}

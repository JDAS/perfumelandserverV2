import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";
import { useStorefront } from "../context/StorefrontContext";

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function Cart() {
  const { cart, removeFromCart, addToCart, decreaseQuantity } = useCartStore();
  const { storefront } = useStorefront();
  const palette = storefront.theme?.palette || {};
  const cartEnabled = storefront.showCart;
  const whatsappEnabled = storefront.showWhatsapp && storefront.whatsappNumber;

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (!cartEnabled) {
    return (
      <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_20px_60px_rgba(13,47,107,0.09)]">
        <h2 className="text-2xl font-semibold text-[#102750]">El carrito no está disponible</h2>
        <p className="mt-3 text-[#5e6682]">
          Puedes seguir explorando fragancias mientras activas esta experiencia desde configuración.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: palette.primary || "#0d2f6b" }}
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className="rounded-[30px] px-5 py-7 text-white shadow-[0_30px_90px_rgba(13,47,107,0.22)] sm:px-8"
        style={{ backgroundColor: palette.primary || "#0d2f6b" }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#ffd8ea]">
          Carrito
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          Tu seleccion de perfumes
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d8e4ff] sm:text-base">
          Revisa tu cotizacion inicial y ajusta cantidades antes de continuar por WhatsApp o desde tu flujo de venta.
        </p>
      </section>

      {cart.length === 0 ? (
        <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_20px_60px_rgba(13,47,107,0.09)]">
          <h2 className="text-2xl font-semibold text-[#102750]">Tu carrito esta vacio</h2>
          <p className="mt-3 text-[#5e6682]">
            Agrega perfumes desde el catalogo para empezar una cotizacion.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            {cart.map((item) => (
              <article
                key={item._id}
                className="grid gap-4 rounded-[28px] bg-white p-4 shadow-[0_20px_60px_rgba(13,47,107,0.09)] sm:grid-cols-[120px_1fr] sm:p-5"
              >
                <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#f7d7e4] via-[#fff7fb] to-[#dce7ff]">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-32 w-full bg-white p-3 object-contain sm:h-full sm:p-4"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-sm font-medium uppercase tracking-[0.25em] text-[#0d2f6b] sm:h-full">
                      {item.brand || "Perfume"}
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#a06386]">
                      {item.brand || "Seleccion Perfumeland"}
                    </p>
                    <h2 className="text-xl font-semibold text-[#102750]">{item.name}</h2>
                    <p className="text-sm text-[#5e6682]">
                      Precio unitario: {formatCurrency(item.price)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-2 self-start rounded-full bg-[#f4f7ff] p-1">
                      <button
                        onClick={() => decreaseQuantity(item._id)}
                        className="h-10 w-10 rounded-full bg-white text-lg font-semibold text-[#102750] shadow-sm"
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold text-[#102750]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="h-10 w-10 rounded-full bg-[#0d2f6b] text-lg font-semibold text-white"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-lg font-bold text-[#0d2f6b]">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item._id)}
                        className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(13,47,107,0.09)]">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
              Resumen
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#102750]">
              Total estimado
            </h2>

            <div className="mt-6 space-y-4 border-t border-[#eef1f8] pt-5">
              <div className="flex items-center justify-between text-sm text-[#5e6682]">
                <span>Productos</span>
                <span>{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold text-[#102750]">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {whatsappEnabled && (
              <a
                href={`https://wa.me/${storefront.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Hola, quiero cotizar los productos de mi carrito en Perfumeland.")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white transition"
                style={{ backgroundColor: palette.primary || "#0d2f6b" }}
              >
                Continuar por WhatsApp
              </a>
            )}

            <p className="mt-4 text-sm leading-6 text-[#6a738d]">
              {whatsappEnabled
                ? "Te llevamos a WhatsApp con esta seleccion para cerrar la cotizacion mas rapido."
                : "Activa WhatsApp cuando quieras convertir esta selección en una cotización guiada."}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

export default Cart;

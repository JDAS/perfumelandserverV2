import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";
import { useStorefront } from "../context/StorefrontContext";

function MainLayout({ children }) {
  const cart = useCartStore((state) => state.cart);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const { storefront } = useStorefront();
  const palette = storefront.theme?.palette || {};
  const whatsappEnabled = storefront.showWhatsapp && storefront.whatsappNumber;
  const cartEnabled = storefront.showCart;

  const whatsappLink = whatsappEnabled
    ? `https://wa.me/${storefront.whatsappNumber.replace(/\D/g, "")}`
    : "";

  return (
    <div
      className="flex min-h-screen flex-col text-[#102750]"
      style={{
        background: `linear-gradient(180deg, ${palette.background || "#eef3ff"} 0%, ${palette.accentSoft || "#fdf7fb"} 42%, ${palette.background || "#f6f8ff"} 100%)`,
        color: palette.text || "#102750",
      }}
    >
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="min-w-0">
            <div
              className="rounded-[22px] px-4 py-2 shadow-[0_10px_30px_rgba(13,47,107,0.18)]"
              style={{ backgroundColor: palette.primary || "#0d2f6b" }}
            >
              <img
                src="/logoName.png"
                alt="Perfumeland"
                className="h-9 w-auto sm:h-10"
              />
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#4e5978] md:flex">
            <Link to="/" className="transition hover:text-[#0d2f6b]">
              Catalogo
            </Link>
            {whatsappEnabled && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-[#0d2f6b]"
              >
                WhatsApp
              </a>
            )}
          </nav>

          {cartEnabled && (
            <Link
              to="/cart"
              className="inline-flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(13,47,107,0.25)] transition"
              style={{ backgroundColor: palette.primary || "#0d2f6b" }}
            >
              <span>Carrito</span>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/15 px-2 text-xs">
                {totalItems}
              </span>
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>

      <footer className="border-t border-white/50 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-[#5e6682] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/logoName.png"
              alt="Perfumeland"
              className="h-8 w-auto rounded px-2 py-1"
              style={{ backgroundColor: palette.primary || "#0d2f6b" }}
            />
            <p>{storefront.siteTagline}</p>
          </div>
          <p
            className="text-xs uppercase tracking-[0.22em]"
            style={{ color: palette.accent || "#a06386" }}
          >
            {storefront.variant?.name || "Storefront"}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MainLayout;

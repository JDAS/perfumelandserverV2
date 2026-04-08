import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";

function MainLayout({ children }) {
  const cart = useCartStore((state) => state.cart);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3ff_0%,#fdf7fb_42%,#f6f8ff_100%)] text-[#102750]">
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0d2f6b] text-lg font-semibold text-white shadow-[0_10px_30px_rgba(13,47,107,0.25)]">
                P
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold tracking-tight text-[#0d2f6b]">
                  Perfumeland
                </p>
                <p className="truncate text-xs uppercase tracking-[0.25em] text-[#a06386]">
                  Boutique store
                </p>
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#4e5978] md:flex">
            <Link to="/" className="transition hover:text-[#0d2f6b]">
              Catalogo
            </Link>
            <a
              href="https://wa.me/50600000000"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-[#0d2f6b]"
            >
              WhatsApp
            </a>
          </nav>

          <Link
            to="/cart"
            className="inline-flex items-center gap-3 rounded-full bg-[#0d2f6b] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(13,47,107,0.25)] transition hover:bg-[#173b80]"
          >
            <span>Carrito</span>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/15 px-2 text-xs">
              {totalItems}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>

      <footer className="border-t border-white/50 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-[#5e6682] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>Perfumeland, una vitrina boutique pensada para explorar y cotizar mejor.</p>
          <p className="text-xs uppercase tracking-[0.22em] text-[#a06386]">
            Responsive storefront
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MainLayout;

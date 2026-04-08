import { useCartStore } from "../store/cartStore";
import { useToast } from "./ui/ToastContext";
import BrandLogo from "./BrandLogo";

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function ProductCard({ product }) {
  const addToCart = useCartStore((state) => state.addToCart);
  const { addToast } = useToast();

  const imageUrl = product.image || "";
  const brand = product.brand || "Perfumeria selecta";

  const handleAddToCart = () => {
    addToCart(product);
    addToast(`${product.name} agregado al carrito`, "success");
  };

  return (
    <article className="group overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_24px_70px_rgba(13,47,107,0.12)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(13,47,107,0.18)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#f7d7e4] via-[#fff6fa] to-[#dce7ff]">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-6 top-5 h-16 w-16 rounded-full bg-white/40 blur-2xl" />
          <div className="absolute bottom-3 right-6 h-20 w-20 rounded-full bg-[#a786da]/30 blur-2xl" />
        </div>

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="relative h-64 w-full object-cover transition duration-500 group-hover:scale-[1.04] sm:h-72"
          />
        ) : (
          <div className="relative flex h-64 w-full items-center justify-center sm:h-72">
            <div className="rounded-full border border-white/70 bg-white/70 px-5 py-2 text-sm font-medium uppercase tracking-[0.35em] text-[#0d2f6b] shadow-sm">
              {brand}
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4">
          <BrandLogo
            brand={brand}
            className="border border-white/40 bg-white/95"
            fallbackClassName="bg-[#0d2f6b]/90 text-white"
          />
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <h3 className="line-clamp-2 text-xl font-semibold text-[#102750]">
            {product.name}
          </h3>
          <p className="line-clamp-2 min-h-[44px] text-sm leading-6 text-[#5e6682]">
            {product.description ||
              "Una seleccion pensada para regalar, coleccionar o elevar tu estilo diario."}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
              Precio
            </p>
            <p className="text-2xl font-bold text-[#0d2f6b]">
              {formatCurrency(product.price)}
            </p>
          </div>

          <button
            onClick={handleAddToCart}
            className="rounded-full bg-[#0d2f6b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#173b80]"
          >
            Agregar
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProductById } from "../services/productService";
import { useCartStore } from "../store/cartStore";
import { useToast } from "../components/ui/ToastContext";
import BrandLogo from "../components/BrandLogo";

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function ProductDetailPage() {
  const { id } = useParams();
  const addToCart = useCartStore((state) => state.addToCart);
  const { addToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState("");

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        const data = await getProductById(id);
        setProduct(data);
        setActiveImage(data.image || data.gallery?.[0] || "");
      } catch (error) {
        console.error("Error cargando producto:", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  const gallery = useMemo(() => {
    if (!product) return [];

    const images = [product.image, ...(product.gallery || [])].filter(Boolean);
    return [...new Set(images)];
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product);
    addToast(`${product.name} agregado al carrito`, "success");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-40 animate-pulse rounded-full bg-white/70" />
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="h-[420px] animate-pulse rounded-[32px] bg-white/70" />
          <div className="h-[420px] animate-pulse rounded-[32px] bg-white/70" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_20px_60px_rgba(13,47,107,0.09)]">
        <h1 className="text-3xl font-semibold text-[#102750]">Producto no encontrado</h1>
        <p className="mt-3 text-[#5e6682]">
          No pudimos cargar este producto o ya no esta disponible.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-[#0d2f6b] px-6 py-3 text-sm font-semibold text-white"
        >
          Volver al catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-[#66708d]">
        <Link to="/" className="transition hover:text-[#0d2f6b]">
          Catalogo
        </Link>
        <span>/</span>
        <span className="truncate">{product.name}</span>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-[#f7d7e4] via-[#fff7fb] to-[#dce7ff] shadow-[0_24px_70px_rgba(13,47,107,0.14)]">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="h-[360px] w-full object-cover sm:h-[460px]"
              />
            ) : (
              <div className="flex h-[360px] items-center justify-center sm:h-[460px]">
                <BrandLogo
                  brand={product.brand}
                  className="px-6 py-4"
                  imgClassName="max-h-16 max-w-[180px]"
                />
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {gallery.map((image) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  className={`overflow-hidden rounded-[20px] border transition ${
                    activeImage === image
                      ? "border-[#0d2f6b] ring-2 ring-[#0d2f6b]/15"
                      : "border-white/60"
                  }`}
                >
                  <img
                    src={image}
                    alt={product.name}
                    className="h-20 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-[0_24px_70px_rgba(13,47,107,0.12)] sm:p-8">
          <div className="space-y-5">
            <BrandLogo
              brand={product.brand}
              className="border border-[#e7ecf8] px-4 py-2"
              imgClassName="max-h-8 max-w-[120px]"
            />

            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-[#102750]">
                {product.name}
              </h1>
              <p className="text-sm uppercase tracking-[0.28em] text-[#a06386]">
                {product.brand || "Seleccion Perfumeland"}
              </p>
            </div>

            <div className="rounded-[24px] bg-[#f6f8ff] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
                Precio
              </p>
              <p className="mt-2 text-4xl font-bold text-[#0d2f6b]">
                {formatCurrency(product.price)}
              </p>
            </div>

            <p className="text-base leading-8 text-[#56617f]">
              {product.description ||
                "Una fragancia lista para una experiencia de compra mas clara, visual y facil de cotizar desde movil o escritorio."}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleAddToCart}
                className="inline-flex items-center justify-center rounded-full bg-[#0d2f6b] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#173b80]"
              >
                Agregar al carrito
              </button>

              <a
                href={`https://wa.me/50600000000?text=${encodeURIComponent(`Hola, quiero cotizar ${product.name}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-[#d7def1] px-6 py-4 text-sm font-semibold text-[#102750] transition hover:bg-[#f6f8ff]"
              >
                Cotizar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductDetailPage;

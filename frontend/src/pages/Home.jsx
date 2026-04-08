import { useEffect, useMemo, useState } from "react";
import { getProducts } from "../services/productService";
import ProductCard from "../components/ProductCard";
import BrandLogo from "../components/BrandLogo";

function Home() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeBrand, setActiveBrand] = useState("Todas");
  const [products, setProducts] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  const brands = useMemo(() => {
    const uniqueBrands = [...new Set(products.map((product) => product.brand).filter(Boolean))];
    return ["Todas", ...uniqueBrands.sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesBrand = activeBrand === "Todas" || product.brand === activeBrand;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        [product.name, product.brand, product.description, product.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesBrand && matchesSearch;
    });
  }, [products, activeBrand, search]);

  const featuredProducts = filteredProducts.slice(0, 6);

  return (
    <div className="space-y-8 pb-12 sm:space-y-10 sm:pb-16">
      <section className="relative overflow-hidden rounded-[32px] bg-[#0d2f6b] px-5 py-8 text-white shadow-[0_30px_90px_rgba(13,47,107,0.28)] sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,168,199,0.30),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(167,134,218,0.20),_transparent_30%)]" />
        <div className="absolute -right-24 top-10 h-64 w-64 rounded-full border border-white/10 bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#f4a8c7]/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="inline-flex rounded-[26px] bg-white/10 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.12)] backdrop-blur">
                <img
                  src="/logoName.png"
                  alt="Perfumeland"
                  className="h-12 w-auto sm:h-14"
                />
              </div>

              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-[#ffd8ea]">
                Boutique de fragancias
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Una vitrina mas elegante para descubrir, regalar y cotizar perfumes.
              </h1>
              <p className="max-w-xl text-sm leading-7 text-[#d8e4ff] sm:text-base">
                Perfumeland combina una experiencia visual limpia con una seleccion de fragancias pensada para venta rapida, cotizacion por WhatsApp y navegacion comoda desde movil.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#catalogo"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0d2f6b] transition hover:bg-[#fef2f7]"
              >
                Explorar catalogo
              </a>
              <a
                href="https://wa.me/50600000000"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Pedir cotizacion
              </a>
            </div>
          </div>

          <div className="grid gap-4 text-[#102750]">
            <div className="rounded-[30px] bg-white/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.10)] backdrop-blur sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
                Curaduria
              </p>
              <p className="mt-3 text-2xl font-semibold leading-snug">
                Fragancias organizadas por marca, listas para una experiencia mas premium.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#edf0f8] pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#a06386]">
                    Marcas
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#0d2f6b]">
                    {Math.max(brands.length - 1, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#a06386]">
                    Catalogo
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#0d2f6b]">
                    {products.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 text-white backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#ffd8ea]">
                  Mobile first
                </p>
                <p className="mt-3 text-lg font-semibold">
                  Catalogo limpio, rapido y listo para vender desde el telefono.
                </p>
              </div>

              <div className="rounded-[26px] bg-[#f7d7e4] p-5 text-[#6b4b60]">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8d5d76]">
                  Conversa y vende
                </p>
                <p className="mt-3 text-lg font-semibold">
                  Del producto al carrito y de ahi a WhatsApp sin friccion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white/85 p-4 shadow-[0_20px_60px_rgba(13,47,107,0.09)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
              Explora el catalogo
            </p>
            <h2 className="text-2xl font-semibold text-[#102750] sm:text-3xl">
              Encuentra una fragancia por marca o nombre
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[420px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar perfumes, marcas o descripciones"
              className="w-full rounded-full border border-[#d9dfef] bg-[#f8faff] px-5 py-3 text-sm text-[#102750] outline-none transition focus:border-[#0d2f6b] focus:bg-white"
            />
            <div className="rounded-full bg-[#f8faff] px-5 py-3 text-center text-sm font-medium text-[#5e6682]">
              {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {brands.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => setActiveBrand(brand)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                activeBrand === brand
                  ? "bg-[#0d2f6b] text-white"
                  : "bg-[#f3f6ff] text-[#48506c] hover:bg-[#e8eefc]"
              }`}
            >
              {brand !== "Todas" && (
                <BrandLogo
                  brand={brand}
                  className={`px-2 py-1 ${
                    activeBrand === brand ? "bg-white/90" : "bg-white"
                  }`}
                  imgClassName="max-h-5 max-w-[64px]"
                  fallbackClassName={
                    activeBrand === brand ? "text-[#0d2f6b]" : "text-[#48506c]"
                  }
                />
              )}
              {brand}
            </button>
          ))}
        </div>
      </section>

      <section id="catalogo" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
              Seleccion destacada
            </p>
            <h2 className="text-2xl font-semibold text-[#102750] sm:text-3xl">
              Una vitrina mas elegante para vender mejor
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[390px] animate-pulse rounded-[28px] bg-white/60"
              />
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center text-[#5e6682] shadow-[0_18px_50px_rgba(13,47,107,0.08)]">
            No encontramos productos con esos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;

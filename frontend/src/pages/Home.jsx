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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,168,199,0.35),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(167,134,218,0.28),_transparent_28%)]" />
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/10 bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#f4a8c7]/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-[#ffd8ea]">
              Perfumeland Boutique
            </span>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Perfumes con presencia, elegancia y una vitrina lista para vender.
              </h1>
              <p className="max-w-xl text-sm leading-7 text-[#d8e4ff] sm:text-base">
                Descubre fragancias seleccionadas para regalar, coleccionar o acompanar tu estilo diario. Una experiencia visual pensada para mobile y lista para crecer contigo.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#catalogo"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0d2f6b] transition hover:bg-[#fef2f7]"
              >
                Ver catalogo
              </a>
              <a
                href="https://wa.me/50600000000"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Cotizar por WhatsApp
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[#0d2f6b] sm:gap-4">
            <div className="rounded-[28px] bg-white/92 p-4 backdrop-blur sm:p-5">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
                Marcas
              </p>
              <p className="mt-3 text-3xl font-bold">{Math.max(brands.length - 1, 0)}</p>
              <p className="mt-2 text-sm text-[#5e6682]">
                Curaduria con enfoque comercial y presentacion premium.
              </p>
            </div>

            <div className="rounded-[28px] bg-[#f7d7e4] p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#7b4964]">
                Catalogo
              </p>
              <p className="mt-3 text-3xl font-bold">{products.length}</p>
              <p className="mt-2 text-sm text-[#6e5870]">
                Productos listos para una experiencia storefront mas cuidada.
              </p>
            </div>

            <div className="col-span-2 rounded-[28px] border border-white/10 bg-white/10 p-4 text-white backdrop-blur sm:p-5">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#ffd8ea]">
                Estilo visual
              </p>
              <p className="mt-3 text-xl font-semibold">
                Azul profundo, rosa suave y composicion boutique pensada primero para movil.
              </p>
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

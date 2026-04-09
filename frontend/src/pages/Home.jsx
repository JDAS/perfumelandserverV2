import { useEffect, useMemo, useState } from "react";
import { getProducts } from "../services/productService";
import ProductCard from "../components/ProductCard";
import BrandLogo from "../components/BrandLogo";
import Seo from "../components/Seo";

function Home() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeBrand, setActiveBrand] = useState("Todas");
  const [activeGender, setActiveGender] = useState("Todos");
  const [sortBy, setSortBy] = useState("featured");
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

  const genders = useMemo(() => {
    const uniqueGenders = [...new Set(products.map((product) => product.gender).filter(Boolean))];
    return ["Todos", ...uniqueGenders.sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const result = products.filter((product) => {
      const matchesBrand = activeBrand === "Todas" || product.brand === activeBrand;
      const matchesGender = activeGender === "Todos" || product.gender === activeGender;
      const term = search.trim().toLowerCase();
      const aliasText = Array.isArray(product.aliases)
        ? product.aliases.join(" ")
        : String(product.aliases || "").replace(/\n/g, " ");
      const matchesSearch =
        !term ||
        [
          product.name,
          product.brand,
          product.short_description,
          product.description,
          product.category,
          aliasText,
          product.gender,
          product.volume ? `${product.volume} ml` : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesBrand && matchesGender && matchesSearch;
    });

    const sorted = [...result];

    if (sortBy === "price-asc") {
      sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      return sorted;
    }

    if (sortBy === "price-desc") {
      sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
      return sorted;
    }

    if (sortBy === "name") {
      sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return sorted;
    }

    sorted.sort((a, b) => {
      const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredDelta !== 0) return featuredDelta;
      return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    });

    return sorted;
  }, [products, activeBrand, activeGender, search, sortBy]);

  const featuredProducts = useMemo(() => {
    const featured = filteredProducts.filter((product) => product.featured);
    return (featured.length > 0 ? featured : filteredProducts).slice(0, 3);
  }, [filteredProducts]);

  const catalogProducts = useMemo(() => {
    const featuredIds = new Set(featuredProducts.map((product) => String(product._id)));
    return filteredProducts.filter((product) => !featuredIds.has(String(product._id)));
  }, [filteredProducts, featuredProducts]);

  return (
    <div className="space-y-8 pb-12 sm:space-y-10 sm:pb-16">
      <Seo
        title="Perfumeland | Perfumes originales y fragancias para cada ocasión"
        description="Descubre perfumes originales, fragancias irresistibles y opciones para regalar, consentirte o cotizar por WhatsApp. Explora la colección de Perfumeland."
        image="/logoName.png"
        canonicalPath="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: "Perfumeland",
          description:
            "Tienda de perfumes y fragancias para regalar, descubrir y cotizar por WhatsApp.",
          image: `${window.location.origin}/logoName.png`,
          url: `${window.location.origin}/`,
        }}
      />
      <section className="relative overflow-hidden rounded-[32px] bg-[#0d2f6b] px-5 py-6 text-white shadow-[0_24px_70px_rgba(13,47,107,0.24)] sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,168,199,0.30),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(167,134,218,0.20),_transparent_30%)]" />
        <div className="absolute -right-24 top-6 h-52 w-52 rounded-full border border-white/10 bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[#f4a8c7]/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-[#ffd8ea]">
                Perfumes que dejan huella
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                Encuentra esa fragancia especial para regalar, enamorar o consentirte.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-[#d8e4ff] sm:text-base">
                Descubre aromas irresistibles, marcas reconocidas y opciones para cada estilo, todo en una experiencia pensada para inspirarte y ayudarte a elegir con facilidad.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#catalogo"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0d2f6b] transition hover:bg-[#fef2f7]"
              >
                Ver colección
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

          <div className="grid gap-4 text-[#102750]">
            <div className="rounded-[28px] bg-white/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.10)] backdrop-blur sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
                Selección especial
              </p>
              <p className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">
                Fragancias elegidas para que encuentres ese aroma que habla por ti.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#edf0f8] pt-4">
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#ffd8ea]">
                  Compra fácil
                </p>
                <p className="mt-2 text-base font-semibold">
                  Explora tus favoritos de forma rápida desde tu celular.
                </p>
              </div>

              <div className="rounded-[24px] bg-[#f7d7e4] p-4 text-[#6b4b60]">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8d5d76]">
                  Atención cercana
                </p>
                <p className="mt-2 text-base font-semibold">
                  Te acompañamos por WhatsApp para cotizar y elegir mejor.
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
              Encuentra tu aroma
            </p>
            <h2 className="text-2xl font-semibold text-[#102750] sm:text-3xl">
              Busca por marca, estilo o el perfume que tienes en mente
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[420px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ejemplo: 9PM, Yara, Afnan, dulce, unisex..."
              className="w-full rounded-full border border-[#d9dfef] bg-[#f8faff] px-5 py-3 text-sm text-[#102750] outline-none transition focus:border-[#0d2f6b] focus:bg-white"
            />
            <div className="rounded-full bg-[#f8faff] px-5 py-3 text-center text-sm font-medium text-[#5e6682]">
              {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_0.9fr_auto]">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-[#a06386]">
              Marca
            </span>
            <select
              value={activeBrand}
              onChange={(event) => setActiveBrand(event.target.value)}
              className="w-full rounded-2xl border border-[#d9dfef] bg-[#f8faff] px-4 py-3 text-sm text-[#102750] outline-none transition focus:border-[#0d2f6b] focus:bg-white"
            >
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-[#a06386]">
              Perfil
            </span>
            <select
              value={activeGender}
              onChange={(event) => setActiveGender(event.target.value)}
              className="w-full rounded-2xl border border-[#d9dfef] bg-[#f8faff] px-4 py-3 text-sm text-[#102750] outline-none transition focus:border-[#0d2f6b] focus:bg-white"
            >
              {genders.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-[#a06386]">
              Ordenar
            </span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full rounded-2xl border border-[#d9dfef] bg-[#f8faff] px-4 py-3 text-sm text-[#102750] outline-none transition focus:border-[#0d2f6b] focus:bg-white"
            >
              <option value="featured">Destacados</option>
              <option value="name">Nombre</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveBrand("Todas");
              setActiveGender("Todos");
              setSortBy("featured");
            }}
            className="rounded-2xl border border-[#d9dfef] px-4 py-3 text-sm font-semibold text-[#102750] transition hover:bg-[#f6f8ff] xl:self-end"
          >
            Limpiar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeBrand !== "Todas" && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3ff] px-3 py-2 text-sm font-medium text-[#102750]">
              <BrandLogo
                brand={activeBrand}
                className="bg-white px-2 py-1"
                imgClassName="max-h-4 max-w-[56px]"
                fallbackClassName="text-[#102750]"
              />
              {activeBrand}
            </span>
          )}
          {activeGender !== "Todos" && (
            <span className="inline-flex items-center rounded-full bg-[#fef3f8] px-3 py-2 text-sm font-medium text-[#8c5f76]">
              {activeGender}
            </span>
          )}
          {sortBy === "featured" && (
            <span className="inline-flex items-center rounded-full bg-[#f4f7ff] px-3 py-2 text-sm font-medium text-[#55607c]">
              Destacados primero
            </span>
          )}
        </div>
      </section>

      <section id="catalogo" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
              Colección Perfumeland
            </p>
            <h2 className="text-2xl font-semibold text-[#102750] sm:text-3xl">
              Descubre perfumes para cada ocasión, estilo y personalidad
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`featured-${index}`}
                  className="h-[390px] animate-pulse rounded-[28px] bg-white/60"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`catalog-${index}`}
                  className="h-[390px] animate-pulse rounded-[28px] bg-white/60"
                />
              ))}
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center text-[#5e6682] shadow-[0_18px_50px_rgba(13,47,107,0.08)]">
            No encontramos productos con esos filtros.
          </div>
        ) : (
          <div className="space-y-8">
            {featuredProducts.length > 0 && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
                    Destacados
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[#102750] sm:text-2xl">
                    Los favoritos del momento
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  {featuredProducts.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              </div>
            )}

            {catalogProducts.length > 0 && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#a06386]">
                    Más para descubrir
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[#102750] sm:text-2xl">
                    Sigue explorando y encuentra tu próxima obsesión
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {catalogProducts.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;

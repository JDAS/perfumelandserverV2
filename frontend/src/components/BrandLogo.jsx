import { useMemo, useState } from "react";

function removeAccents(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toUnderscoreCase(value = "") {
  return removeAccents(value)
    .replace(/&/g, "_&_")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toDashCase(value = "") {
  return removeAccents(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCompactLower(value = "") {
  return removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildCandidateSources(brand = "") {
  const original = String(brand || "").trim();
  if (!original) return [];

  const variants = [
    original,
    removeAccents(original),
    toUnderscoreCase(original),
    toDashCase(original),
    toCompactLower(original),
  ].filter(Boolean);

  const uniqueVariants = [...new Set(variants)];
  const extensions = ["png", "svg", "webp", "jpg", "jpeg"];

  return uniqueVariants.flatMap((variant) =>
    extensions.map((extension) => `/brand-logos/${variant}.${extension}`)
  );
}

function BrandLogo({
  brand,
  className = "",
  imgClassName = "",
  fallbackClassName = "",
  showFallback = true,
}) {
  const sources = useMemo(() => buildCandidateSources(brand), [brand]);
  const [sourceIndex, setSourceIndex] = useState(0);

  if (!brand) return null;

  if (!sources.length || sourceIndex >= sources.length) {
    if (!showFallback) return null;

    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0d2f6b] ${className} ${fallbackClassName}`}
      >
        {brand}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-white/90 px-3 py-2 shadow-sm ${className}`}
    >
      <img
        src={sources[sourceIndex]}
        alt={`Logo de ${brand}`}
        className={`max-h-7 max-w-[92px] object-contain ${imgClassName}`}
        onError={() => setSourceIndex((prev) => prev + 1)}
      />
    </div>
  );
}

export default BrandLogo;

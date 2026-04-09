import { useEffect } from "react";

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value != null && value !== "") {
      element.setAttribute(key, value);
    }
  });
}

function upsertLink(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value != null && value !== "") {
      element.setAttribute(key, value);
    }
  });
}

function ensureAbsoluteUrl(value) {
  if (!value) return "";

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

function Seo({
  title,
  description,
  image,
  type = "website",
  canonicalPath = "",
  jsonLd = null,
}) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    const absoluteUrl = ensureAbsoluteUrl(canonicalPath || window.location.pathname);
    const absoluteImage = ensureAbsoluteUrl(image || "/logoName.png");

    if (description) {
      upsertMeta('meta[name="description"]', { name: "description", content: description });
      upsertMeta('meta[property="og:description"]', {
        property: "og:description",
        content: description,
      });
      upsertMeta('meta[name="twitter:description"]', {
        name: "twitter:description",
        content: description,
      });
    }

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: absoluteUrl });
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: absoluteImage,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: absoluteImage,
    });
    upsertLink('link[rel="canonical"]', { rel: "canonical", href: absoluteUrl });

    const jsonLdId = "seo-jsonld";
    const previousScript = document.getElementById(jsonLdId);
    if (previousScript) {
      previousScript.remove();
    }

    if (jsonLd) {
      const script = document.createElement("script");
      script.id = jsonLdId;
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const currentScript = document.getElementById(jsonLdId);
      if (currentScript) {
        currentScript.remove();
      }
    };
  }, [canonicalPath, description, image, jsonLd, title, type]);

  return null;
}

export default Seo;

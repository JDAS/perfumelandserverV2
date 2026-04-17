import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardsAdmin from "../components/admin/DashboardsAdmin";
import ReportsAdmin from "../components/admin/ReportsAdmin";
import UsersAdmin from "../components/admin/UsersAdmin";
import {
  deleteObject,
  getStorefrontSettings,
  updateStorefrontSettings,
} from "../services/customService";
import ObjectModal from "../components/ObjectModal";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { useToast } from "../components/ui/ToastContext";
import { useStorefront } from "../context/StorefrontContext";
import { adminGradient, adminTheme } from "../theme/adminTheme";

const defaultStorefrontForm = {
  themeId: "boutique-classic",
  variantId: "boutique",
  logoUrl: "/logoName.png",
  logoAlt: "Perfumeland",
  showCart: false,
  showWhatsapp: false,
  whatsappNumber: "",
  heroBadge: "",
  heroTitle: "",
  heroSubtitle: "",
  heroPrimaryCtaLabel: "",
  heroSecondaryCtaLabel: "",
  highlightEyebrow: "",
  highlightTitle: "",
  featureOneEyebrow: "",
  featureOneText: "",
  featureTwoEyebrow: "",
  featureTwoText: "",
  siteTagline: "",
};

function SettingsPage() {
  const { addToast } = useToast();
  const { refreshStorefront } = useStorefront();
  const [activeSection, setActiveSection] = useState("storefront");
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState(null);
  const { objects, loading, refreshObjects } = useObjectMetadata();

  const [storefrontLoading, setStorefrontLoading] = useState(true);
  const [storefrontSaving, setStorefrontSaving] = useState(false);
  const [availableThemes, setAvailableThemes] = useState([]);
  const [availableVariants, setAvailableVariants] = useState([]);
  const [storefrontForm, setStorefrontForm] = useState(defaultStorefrontForm);

  useEffect(() => {
    if (activeSection === "storefront") {
      loadStorefrontSettings();
    }
  }, [activeSection]);

  const loadStorefrontSettings = async () => {
    try {
      setStorefrontLoading(true);
      const data = await getStorefrontSettings();
      setAvailableThemes(data.availableThemes || []);
      setAvailableVariants(data.availableVariants || []);
      setStorefrontForm({
        ...defaultStorefrontForm,
        ...(data.storefront || {}),
      });
    } catch (error) {
      console.error(error);
      addToast("No se pudo cargar la configuración del storefront", "error");
    } finally {
      setStorefrontLoading(false);
    }
  };

  const handleDeleteObject = async (apiName) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el objeto "${apiName}"?`)) return;
    try {
      await deleteObject(apiName);
      await refreshObjects();
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.error || "Error eliminando el objeto", "error");
    }
  };

  const handleStorefrontChange = (key, value) => {
    setStorefrontForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveStorefront = async (event) => {
    event.preventDefault();
    try {
      setStorefrontSaving(true);
      await updateStorefrontSettings({ storefront: storefrontForm });
      await refreshStorefront();
      addToast("Storefront actualizado", "success");
      await loadStorefrontSettings();
    } catch (error) {
      console.error(error);
      addToast(
        error?.response?.data?.error || "No se pudo guardar la configuración del storefront",
        "error"
      );
    } finally {
      setStorefrontSaving(false);
    }
  };

  const selectedTheme = availableThemes.find((theme) => theme.id === storefrontForm.themeId);
  const previewPalette = selectedTheme?.palette || {};

  return (
    <div
      className="min-h-screen flex"
      style={{ background: `linear-gradient(180deg, ${adminTheme.bg} 0%, #eef2f7 100%)` }}
    >
      <aside
        className="w-80 border-r p-6 space-y-8"
        style={{ backgroundColor: adminTheme.surface, borderColor: adminTheme.border }}
      >
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">Administración general del sistema</p>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-3">Navegación</h2>
          <div className="space-y-2">
            <button
              className="block w-full text-left px-3 py-2 rounded-xl"
              style={
                activeSection === "storefront"
                  ? { background: adminGradient(), color: "#fff" }
                  : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }
              }
              onClick={() => setActiveSection("storefront")}
            >
              Storefront
            </button>
            <button
              className="block w-full text-left px-3 py-2 rounded-xl"
              style={
                activeSection === "reportes"
                  ? { background: adminGradient(), color: "#fff" }
                  : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }
              }
              onClick={() => setActiveSection("reportes")}
            >
              Reportes
            </button>
            <button
              className="block w-full text-left px-3 py-2 rounded-xl"
              style={
                activeSection === "dashboards"
                  ? { background: adminGradient(), color: "#fff" }
                  : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }
              }
              onClick={() => setActiveSection("dashboards")}
            >
              Dashboards
            </button>
            <button
              className="block w-full text-left px-3 py-2 rounded-xl"
              style={
                activeSection === "objects"
                  ? { background: adminGradient(), color: "#fff" }
                  : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }
              }
              onClick={() => setActiveSection("objects")}
            >
              Objetos
            </button>
            <button
              className="block w-full text-left px-3 py-2 rounded-xl"
              style={
                activeSection === "users"
                  ? { background: adminGradient(), color: "#fff" }
                  : { backgroundColor: adminTheme.surfaceAlt, color: adminTheme.text }
              }
              onClick={() => setActiveSection("users")}
            >
              Usuarios
            </button>
            </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeSection === "storefront" && (
          <div
            className="rounded-2xl p-6 shadow-[0_18px_48px_rgba(17,24,39,0.08)]"
            style={{ backgroundColor: adminTheme.surface }}
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Storefront</h2>
                <p className="text-sm text-gray-500">
                  Configura el estilo, la experiencia y los textos del frente público.
                </p>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl text-white"
                style={{ background: adminGradient() }}
              >
                Ver storefront
              </a>
            </div>

            {storefrontLoading ? (
              <p>Cargando configuración...</p>
            ) : (
              <form onSubmit={handleSaveStorefront} className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Identidad visual</h3>
                    <p className="text-sm text-gray-500">
                      Elige el estilo base del front y la paleta que se mostrará al cliente.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tipo de front</span>
                      <select
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.variantId}
                        onChange={(event) =>
                          handleStorefrontChange("variantId", event.target.value)
                        }
                      >
                        {availableVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Paleta</span>
                      <select
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.themeId}
                        onChange={(event) =>
                          handleStorefrontChange("themeId", event.target.value)
                        }
                      >
                        {availableThemes.map((theme) => (
                          <option key={theme.id} value={theme.id}>
                            {theme.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Logo del storefront</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        placeholder="/logoName.png o https://..."
                        value={storefrontForm.logoUrl}
                        onChange={(event) =>
                          handleStorefrontChange("logoUrl", event.target.value)
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Texto alternativo del logo</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        placeholder="Perfumeland"
                        value={storefrontForm.logoAlt}
                        onChange={(event) =>
                          handleStorefrontChange("logoAlt", event.target.value)
                        }
                      />
                    </label>
                  </div>

                  {selectedTheme?.palette && (
                    <div className="rounded-2xl border p-4">
                      <p className="text-sm font-medium mb-3">Vista rápida de la paleta</p>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(selectedTheme.palette).map(([key, value]) => (
                          <div key={key} className="space-y-2 text-center">
                            <div
                              className="h-12 w-12 rounded-full border"
                              style={{ backgroundColor: value }}
                            />
                            <p className="text-xs text-gray-500">{key}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-medium mb-3">Vista previa del logo</p>
                    <div
                      className="inline-flex rounded-[22px] px-4 py-3 shadow-[0_10px_30px_rgba(13,47,107,0.18)]"
                      style={{ backgroundColor: previewPalette.primary || "#0d2f6b" }}
                    >
                      <img
                        src={storefrontForm.logoUrl || "/logoName.png"}
                        alt={storefrontForm.logoAlt || "Storefront logo"}
                        className="h-10 w-auto"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Canales y experiencia</h3>
                    <p className="text-sm text-gray-500">
                      Activa o desactiva funciones del storefront según la etapa del producto.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-xl border p-4">
                      <input
                        type="checkbox"
                        checked={Boolean(storefrontForm.showCart)}
                        onChange={(event) =>
                          handleStorefrontChange("showCart", event.target.checked)
                        }
                      />
                      <div>
                        <p className="font-medium">Habilitar carrito</p>
                        <p className="text-sm text-gray-500">
                          Muestra el carrito y permite agregar productos.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border p-4">
                      <input
                        type="checkbox"
                        checked={Boolean(storefrontForm.showWhatsapp)}
                        onChange={(event) =>
                          handleStorefrontChange("showWhatsapp", event.target.checked)
                        }
                      />
                      <div>
                        <p className="font-medium">Habilitar WhatsApp</p>
                        <p className="text-sm text-gray-500">
                          Muestra enlaces de cotización y contacto.
                        </p>
                      </div>
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium">Número de WhatsApp</span>
                    <input
                      type="text"
                      className="w-full rounded-lg border p-3"
                      placeholder="50688887777"
                      value={storefrontForm.whatsappNumber}
                      onChange={(event) =>
                        handleStorefrontChange("whatsappNumber", event.target.value)
                      }
                    />
                  </label>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Hero y textos de marca</h3>
                    <p className="text-sm text-gray-500">
                      Personaliza la portada principal y el tono del storefront.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Badge superior</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.heroBadge}
                        onChange={(event) =>
                          handleStorefrontChange("heroBadge", event.target.value)
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Título principal</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.heroTitle}
                        onChange={(event) =>
                          handleStorefrontChange("heroTitle", event.target.value)
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Subtítulo</span>
                      <textarea
                        className="w-full rounded-lg border p-3 min-h-28"
                        value={storefrontForm.heroSubtitle}
                        onChange={(event) =>
                          handleStorefrontChange("heroSubtitle", event.target.value)
                        }
                      />
                    </label>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">CTA principal</span>
                        <input
                          type="text"
                          className="w-full rounded-lg border p-3"
                          value={storefrontForm.heroPrimaryCtaLabel}
                          onChange={(event) =>
                            handleStorefrontChange(
                              "heroPrimaryCtaLabel",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">CTA secundario</span>
                        <input
                          type="text"
                          className="w-full rounded-lg border p-3"
                          value={storefrontForm.heroSecondaryCtaLabel}
                          onChange={(event) =>
                            handleStorefrontChange(
                              "heroSecondaryCtaLabel",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Eyebrow de tarjeta principal</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.highlightEyebrow}
                        onChange={(event) =>
                          handleStorefrontChange("highlightEyebrow", event.target.value)
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Título de tarjeta principal</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.highlightTitle}
                        onChange={(event) =>
                          handleStorefrontChange("highlightTitle", event.target.value)
                        }
                      />
                    </label>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tarjeta 1 · Eyebrow</span>
                        <input
                          type="text"
                          className="w-full rounded-lg border p-3"
                          value={storefrontForm.featureOneEyebrow}
                          onChange={(event) =>
                            handleStorefrontChange("featureOneEyebrow", event.target.value)
                          }
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tarjeta 1 · Texto</span>
                        <input
                          type="text"
                          className="w-full rounded-lg border p-3"
                          value={storefrontForm.featureOneText}
                          onChange={(event) =>
                            handleStorefrontChange("featureOneText", event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tarjeta 2 · Eyebrow</span>
                        <input
                          type="text"
                          className="w-full rounded-lg border p-3"
                          value={storefrontForm.featureTwoEyebrow}
                          onChange={(event) =>
                            handleStorefrontChange("featureTwoEyebrow", event.target.value)
                          }
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tarjeta 2 · Texto</span>
                        <input
                          type="text"
                          className="w-full rounded-lg border p-3"
                          value={storefrontForm.featureTwoText}
                          onChange={(event) =>
                            handleStorefrontChange("featureTwoText", event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tagline del footer</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border p-3"
                        value={storefrontForm.siteTagline}
                        onChange={(event) =>
                          handleStorefrontChange("siteTagline", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Preview rápido</h3>
                    <p className="text-sm text-gray-500">
                      Una vista compacta del storefront con la configuración actual antes de guardar.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border bg-[#f8fafc] p-4">
                    <div
                      className="overflow-hidden rounded-[24px] px-4 py-5 text-white shadow-[0_18px_40px_rgba(13,47,107,0.18)]"
                      style={{
                        background: `linear-gradient(135deg, ${previewPalette.primary || "#0d2f6b"} 0%, ${previewPalette.primarySoft || "#173b80"} 100%)`,
                      }}
                    >
                      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                          <span
                            className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em]"
                            style={{ color: previewPalette.accentSoft || "#ffd8ea" }}
                          >
                            {storefrontForm.heroBadge || "Badge"}
                          </span>

                          <div className="space-y-3">
                            <h4 className="max-w-xl text-2xl font-semibold leading-tight">
                              {storefrontForm.heroTitle || "Título principal del storefront"}
                            </h4>
                            <p className="max-w-xl text-sm leading-6 text-white/85">
                              {storefrontForm.heroSubtitle ||
                                "Subtítulo descriptivo para presentar la propuesta del storefront."}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <span
                              className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold"
                              style={{ color: previewPalette.primary || "#0d2f6b" }}
                            >
                              {storefrontForm.heroPrimaryCtaLabel || "CTA principal"}
                            </span>
                            {storefrontForm.showWhatsapp && (
                              <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white">
                                {storefrontForm.heroSecondaryCtaLabel || "CTA secundario"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="rounded-[22px] bg-white/95 p-4 text-[#102750]">
                            <p
                              className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                              style={{ color: previewPalette.accent || "#a06386" }}
                            >
                              {storefrontForm.highlightEyebrow || "Eyebrow"}
                            </p>
                            <p className="mt-2 text-lg font-semibold">
                              {storefrontForm.highlightTitle ||
                                "Texto principal del bloque destacado"}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[20px] border border-white/10 bg-white/10 p-4 text-white">
                              <p
                                className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                                style={{ color: previewPalette.accentSoft || "#ffd8ea" }}
                              >
                                {storefrontForm.featureOneEyebrow || "Tarjeta 1"}
                              </p>
                              <p className="mt-2 text-sm font-semibold leading-6">
                                {storefrontForm.featureOneText ||
                                  "Texto corto de apoyo para la primera tarjeta."}
                              </p>
                            </div>

                            <div
                              className="rounded-[20px] p-4"
                              style={{
                                backgroundColor: previewPalette.accentSoft || "#f7d7e4",
                                color: previewPalette.text || "#102750",
                              }}
                            >
                              <p
                                className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                                style={{ color: previewPalette.accent || "#8d5d76" }}
                              >
                                {storefrontForm.featureTwoEyebrow || "Tarjeta 2"}
                              </p>
                              <p className="mt-2 text-sm font-semibold leading-6">
                                {storefrontForm.featureTwoText ||
                                  "Texto corto de apoyo para la segunda tarjeta."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-2 text-gray-700 shadow-sm">
                        Variant: {storefrontForm.variantId}
                      </span>
                      <span className="rounded-full bg-white px-3 py-2 text-gray-700 shadow-sm">
                        Theme: {storefrontForm.themeId}
                      </span>
                      <span className="rounded-full bg-white px-3 py-2 text-gray-700 shadow-sm">
                        Carrito: {storefrontForm.showCart ? "Activo" : "Oculto"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-2 text-gray-700 shadow-sm">
                        WhatsApp: {storefrontForm.showWhatsapp ? "Activo" : "Oculto"}
                      </span>
                    </div>
                  </div>
                </section>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={storefrontSaving}
                    className="px-5 py-3 rounded-xl text-white disabled:opacity-60"
                    style={{ background: adminGradient() }}
                  >
                    {storefrontSaving ? "Guardando..." : "Guardar storefront"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeSection === "reportes" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Configuración de reportes</h2>
              <p className="text-sm text-gray-500">
                Diseña reportes reutilizables para métricas, tablas y dashboards.
              </p>
            </div>
            <ReportsAdmin objects={objects} />
          </div>
        )}

        {activeSection === "dashboards" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Configuración de dashboards</h2>
              <p className="text-sm text-gray-500">
                Arma dashboards internos a partir de los reportes ya configurados.
              </p>
            </div>
            <DashboardsAdmin />
          </div>
        )}

        {activeSection === "objects" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Objetos</h2>
                <p className="text-sm text-gray-500">Administra objetos, tabs y metadata</p>
              </div>
              <button
                onClick={() => {
                  setEditingObject(null);
                  setIsObjectModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-white"
                style={{ background: adminGradient() }}
              >
                Nuevo objeto
              </button>
            </div>

            {loading ? (
              <p>Cargando objetos...</p>
            ) : objects.length === 0 ? (
              <p className="text-gray-500">No hay objetos creados.</p>
            ) : (
              <div className="space-y-3">
                {objects.map((obj) => (
                  <div
                    key={obj.apiName}
                    className="border rounded-lg p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold">{obj.name}</p>
                      <p className="text-sm text-gray-500">{obj.apiName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {obj.active === false ? "Inactivo" : "Activo"} ·{" "}
                        {obj.tabsEnabled === false ? "Sin tab" : "Con tab"}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button
                        onClick={() => {
                          setEditingObject(obj);
                          setIsObjectModalOpen(true);
                        }}
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                      >
                        Editar rápido
                      </button>
                      <Link
                        to={`/admin/object/${obj.apiName}`}
                        className="px-3 py-1 bg-black text-white rounded"
                      >
                        Editar metadata
                      </Link>
                      <Link
                        to={`/admin/${obj.apiName}/new?tab=${obj.apiName}`}
                        className="px-3 py-1 bg-blue-600 text-white rounded"
                      >
                        Nuevo registro
                      </Link>
                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded"
                        onClick={() => handleDeleteObject(obj.apiName)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "users" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Usuarios</h2>
              <p className="text-sm text-gray-500">
                Registra accesos internos y revisa rapidamente quienes pueden entrar al sistema.
              </p>
            </div>
            <UsersAdmin />
          </div>
        )}
      </main>

      <ObjectModal
        open={isObjectModalOpen}
        initialData={editingObject}
        onClose={() => {
          setIsObjectModalOpen(false);
          setEditingObject(null);
        }}
        onSaved={refreshObjects}
      />
    </div>
  );
}

export default SettingsPage;

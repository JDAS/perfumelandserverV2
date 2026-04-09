import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteObject,
  getStorefrontSettings,
  updateStorefrontSettings,
} from "../services/customService";
import ObjectModal from "../components/ObjectModal";
import { useObjectMetadata } from "../context/ObjectMetadataContext";
import { useToast } from "../components/ui/ToastContext";
import { useStorefront } from "../context/StorefrontContext";

const defaultStorefrontForm = {
  themeId: "boutique-classic",
  variantId: "boutique",
  showCart: false,
  showWhatsapp: false,
  whatsappNumber: "",
  heroBadge: "",
  heroTitle: "",
  heroSubtitle: "",
  heroPrimaryCtaLabel: "",
  heroSecondaryCtaLabel: "",
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

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-80 bg-white border-r p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">Administración general del sistema</p>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-3">Navegación</h2>
          <div className="space-y-2">
            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "storefront" ? "bg-black text-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("storefront")}
            >
              Storefront
            </button>
            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "objects" ? "bg-black text-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("objects")}
            >
              Objetos
            </button>
            <button
              className={`block w-full text-left px-3 py-2 rounded ${
                activeSection === "profiles" ? "bg-black text-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveSection("profiles")}
            >
              Perfiles
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeSection === "storefront" && (
          <div className="bg-white rounded-xl shadow p-6">
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
                className="px-4 py-2 rounded bg-black text-white"
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

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={storefrontSaving}
                    className="bg-black text-white px-5 py-3 rounded-lg disabled:opacity-60"
                  >
                    {storefrontSaving ? "Guardando..." : "Guardar storefront"}
                  </button>
                </div>
              </form>
            )}
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
                className="bg-black text-white px-4 py-2 rounded"
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

        {activeSection === "profiles" && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Perfiles</h2>
            <p className="text-gray-500">Esta sección estará disponible más adelante.</p>
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

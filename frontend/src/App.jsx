import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastContext";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminRoute from "./components/AdminRoute";
import { ObjectMetadataProvider } from "./context/ObjectMetadataContext";
import { StorefrontProvider } from "./context/StorefrontContext";

const Home = lazy(() => import("./pages/Home"));
const Cart = lazy(() => import("./pages/Cart"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminWorkspaceLab = lazy(() => import("./pages/AdminWorkspaceLab"));
const AdminWorkspaceLab2 = lazy(() => import("./pages/AdminWorkspaceLab2"));
const DynamicForm = lazy(() => import("./pages/DynamicForm"));
const Builder = lazy(() => import("./pages/Builder"));
const ObjectMetadataPage = lazy(() => import("./pages/ObjectMetadataPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const QuoteBuilderPage = lazy(() => import("./pages/QuoteBuilderPage"));
const RecordDetailPage = lazy(() => import("./pages/RecordDetailPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="rounded-2xl border bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        Cargando vista...
      </div>
    </div>
  );
}

function App() {
  return (
    <ObjectMetadataProvider>
      <StorefrontProvider>
        <BrowserRouter>
          <ToastProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<MainLayout><Home /></MainLayout>} />
                <Route path="/cart" element={<MainLayout><Cart /></MainLayout>} />
                <Route path="/products/:id" element={<MainLayout><ProductDetailPage /></MainLayout>} />
                <Route path="/login" element={<LoginPage />} />

                <Route
                  path="/admin"
                  element={<AdminRoute><AdminLayout><Admin /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/settings"
                  element={<AdminRoute><AdminLayout><SettingsPage /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/workspace-lab"
                  element={<AdminRoute><AdminLayout><AdminWorkspaceLab /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/workspace-lab-2"
                  element={<AdminRoute><AdminLayout><AdminWorkspaceLab2 /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/object/:apiName"
                  element={<AdminRoute><AdminLayout><ObjectMetadataPage /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/:object/new"
                  element={<AdminRoute><AdminLayout><DynamicForm /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/quote-builder"
                  element={<AdminRoute><AdminLayout><QuoteBuilderPage /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/quote-builder/:id"
                  element={<AdminRoute><AdminLayout><QuoteBuilderPage /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/builder"
                  element={<AdminRoute><AdminLayout><Builder /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/:object/:id"
                  element={<AdminRoute><AdminLayout><DynamicForm /></AdminLayout></AdminRoute>}
                />
                <Route
                  path="/admin/:object/:id/view"
                  element={<AdminRoute><AdminLayout><RecordDetailPage /></AdminLayout></AdminRoute>}
                />
              </Routes>
            </Suspense>
          </ToastProvider>
        </BrowserRouter>
      </StorefrontProvider>
    </ObjectMetadataProvider>
  );
}

export default App;

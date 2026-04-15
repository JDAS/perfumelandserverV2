import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastContext";


import Home from "./pages/Home";
import Cart from "./pages/Cart";
import ProductDetailPage from "./pages/ProductDetailPage";
import LoginPage from "./pages/LoginPage";
import Admin from "./pages/Admin";
import AdminWorkspaceLab from "./pages/AdminWorkspaceLab";
import DynamicForm from "./pages/DynamicForm";
import Builder from "./pages/Builder";
import ObjectMetadataPage from "./pages/ObjectMetadataPage";
import SettingsPage from "./pages/SettingsPage";
import QuoteBuilderPage from "./pages/QuoteBuilderPage";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminRoute from "./components/AdminRoute";
import RecordDetailPage from "./pages/RecordDetailPage";
import { ObjectMetadataProvider } from "./context/ObjectMetadataContext";
import { StorefrontProvider } from "./context/StorefrontContext";

function App() {
  return (
    <ObjectMetadataProvider>
      <StorefrontProvider>
        <BrowserRouter>
          <ToastProvider>
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
          </ToastProvider>
        </BrowserRouter>
      </StorefrontProvider>
    </ObjectMetadataProvider>
  );
}

export default App;

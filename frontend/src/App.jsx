import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Cart from "./pages/Cart";
import LoginPage from "./pages/LoginPage";

import Admin from "./pages/Admin";
import DynamicForm from "./pages/DynamicForm";
import Builder from "./pages/Builder";
import ObjectMetadataPage from "./pages/ObjectMetadataPage";
import SettingsPage from "./pages/SettingsPage";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

import AdminRoute from "./components/AdminRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLICO */}
        <Route path="/" element={<MainLayout><Home /></MainLayout>} />
        <Route path="/cart" element={<MainLayout><Cart /></MainLayout>} />

        {/* LOGIN */}
        <Route path="/login" element={<LoginPage />} />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout><Admin /></AdminLayout>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminLayout><SettingsPage /></AdminLayout>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/object/:apiName"
          element={
            <AdminRoute>
              <AdminLayout><ObjectMetadataPage /></AdminLayout>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/:object/new"
          element={
            <AdminRoute>
              <AdminLayout><DynamicForm /></AdminLayout>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/builder"
          element={
            <AdminRoute>
              <AdminLayout><Builder /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/:object/:id"
          element={
            <AdminRoute>
              <AdminLayout><DynamicForm /></AdminLayout>
            </AdminRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import MainLayout from "./layouts/MainLayout";
import Cart from "./pages/Cart";
import Admin from "./pages/Admin";
import ProtectedRoute from "./components/ProtectedRoute";
import DynamicForm from "./pages/DynamicForm";
import Builder from "./pages/Builder";
import ObjectMetadataPage from "./pages/ObjectMetadataPage";
import SettingsPage from "./pages/SettingsPage";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/:object/new" element={<AdminRoute><DynamicForm /></AdminRoute>} />
          <Route path="/admin/builder" element={<AdminRoute><Builder /></AdminRoute>} />
          <Route path="/admin/object/:apiName" element={<AdminRoute><ObjectMetadataPage /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
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
          <Route path="/admin/:object/new" element={<DynamicForm />} />
          <Route path="/admin/builder" element={<Builder />} />
          <Route path="/admin/object/:apiName" element={<ObjectMetadataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
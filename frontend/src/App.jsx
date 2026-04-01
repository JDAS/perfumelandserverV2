import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import MainLayout from "./layouts/MainLayout";
import Cart from "./pages/Cart";
import Admin from "./pages/Admin";
import ProtectedRoute from "./components/ProtectedRoute";
import DynamicForm from "./pages/DynamicForm";

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
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
import { useState } from "react";
import { createProduct } from "../services/productService";

function Admin() {
  const [form, setForm] = useState({
    name: "",
    brand: "",
    price: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createProduct(form);
      alert("Producto creado ✅");
    } catch (error) {
      alert("Error ❌");
    }
  };

  return (
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Nombre"
          className="w-full border p-2"
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <input
          placeholder="Marca"
          className="w-full border p-2"
          onChange={(e) =>
            setForm({ ...form, brand: e.target.value })
          }
        />

        <input
          placeholder="Precio"
          type="number"
          className="w-full border p-2"
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
        />

        <button className="bg-black text-white w-full py-2">
          Crear Producto
        </button>
      </form>
    </div>
  );
}

export default Admin;
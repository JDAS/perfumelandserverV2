import { useCartStore } from "../store/cartStore";

function ProductCard({ product }) {
    const addToCart = useCartStore((state) => state.addToCart);
  return (
    <div className="bg-white rounded-2xl shadow hover:scale-105 transition transform p-4">
      
      {/* Imagen */}
      <div className="h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
        <span className="text-gray-500">Imagen</span>
      </div>

      {/* Info */}
      <h2 className="text-lg font-semibold">{product.name}</h2>
      <p className="text-gray-500 text-sm">{product.brand}</p>

      <p className="text-green-600 font-bold text-xl mt-2">
        ₡{product.price}
      </p>

      <button
        onClick={() => addToCart(product)}
        className="mt-4 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
        >
        Agregar al carrito
      </button>
    </div>
  );
}

export default ProductCard;
import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";

function MainLayout({ children }) {
  const cart = useCartStore((state) => state.cart);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-black text-white p-4 flex justify-between items-center">
        <Link to="/">
          <h1 className="text-2xl font-bold">Perfumeland</h1>
        </Link>

        <Link to="/cart">
          🛒 <span className="font-bold">{totalItems}</span>
        </Link>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}

export default MainLayout;
import { useCartStore } from "../store/cartStore";

function Cart() {
  const { cart, removeFromCart, addToCart, decreaseQuantity } = useCartStore();

  const total = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">Carrito</h1>

      {cart.length === 0 ? (
        <p>El carrito está vacío</p>
      ) : (
        <>
          <div className="space-y-4">
            {cart.map((item) => (
              <div
                key={item._id}
                className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
              >
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="text-gray-500">{item.brand}</p>
                  <p>₡{item.price}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => removeFromCart(item._id)}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    ❌
                  </button>

                  <button
                    onClick={() => addToCart(item)}
                    className="bg-black text-white px-3 py-1 rounded"
                  >
                    +
                  </button>
                  <button
                    onClick={() => decreaseQuantity(item._id)}
                    className="bg-gray-300 px-3 py-1 rounded"
                    >
                    -
                    </button>

                  <span>{item.quantity}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-right">
            <h2 className="text-2xl font-bold">
              Total: ₡{total}
            </h2>
          </div>
        </>
      )}
    </div>
  );
}

export default Cart;
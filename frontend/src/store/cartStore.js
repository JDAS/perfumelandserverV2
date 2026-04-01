import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useCartStore = create(
  persist(
    (set) => ({
      cart: [],

      addToCart: (product) =>
        set((state) => {
          const exists = state.cart.find((p) => p._id === product._id);

          if (exists) {
            return {
              cart: state.cart.map((p) =>
                p._id === product._id
                  ? { ...p, quantity: p.quantity + 1 }
                  : p
              ),
            };
          }

          return {
            cart: [...state.cart, { ...product, quantity: 1 }],
          };
        }),

      removeFromCart: (id) =>
        set((state) => ({
          cart: state.cart.filter((p) => p._id !== id),
        })),

      clearCart: () => set({ cart: [] }),
      decreaseQuantity: (id) =>
  set((state) => ({
    cart: state.cart
      .map((item) =>
        item._id === id
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
      .filter((item) => item.quantity > 0),
  })),
    }),
    {
      name: "cart-storage",
    }
  )
);
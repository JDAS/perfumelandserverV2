import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,

      setAuth: ({ user, token }) => set({ user, token }),

      updateUser: (nextUser) =>
        set((state) => ({
          user:
            typeof nextUser === "function"
              ? nextUser(state.user)
              : { ...(state.user || {}), ...(nextUser || {}) },
        })),

      logout: () => set({ user: null, token: null }),
    }),
    {
      name: "auth-storage",
    }
  )
);

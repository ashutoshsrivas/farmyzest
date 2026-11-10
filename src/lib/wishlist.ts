"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Client-side wishlist. Persisted to localStorage so it survives reloads and
// works for guests (no auth required). Keyed by productId — wishlisting is a
// product-level action, not variant-level. If we later want server-synced
// wishlists per account, this store can hydrate from / push to an API without
// changing the component API.

export type WishlistItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string;
  categoryName?: string;
};

type WishlistStore = {
  items: WishlistItem[];
  has: (productId: string) => boolean;
  toggle: (item: WishlistItem) => void;
  add: (item: WishlistItem) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: () => number;
};

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      has: (productId) => get().items.some((i) => i.productId === productId),
      toggle: (item) =>
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? { items: state.items.filter((i) => i.productId !== item.productId) }
            : { items: [item, ...state.items] }
        ),
      add: (item) =>
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? state
            : { items: [item, ...state.items] }
        ),
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
      count: () => get().items.length,
    }),
    { name: "ss_wishlist" }
  )
);

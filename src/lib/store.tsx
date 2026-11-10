"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ProductVariant, Product, ProductImage } from "@prisma/client";

export type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  variantLabel: string;
  price: number;
  imageUrl: string;
  quantity: number;
  stock: number;
  // Special/discounted line — drives the red ".price-special" treatment in the
  // cart, checkout and everywhere the bag is shown. Optional so older persisted
  // carts (and non-discounted adds) simply render in the default colour.
  isSpecial?: boolean;
  // Original (pre-discount) unit price, for the struck-through reference.
  mrp?: number | null;
};

type CartStore = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  setIsOpen: (open: boolean) => void;
  total: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (item) => {
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: Math.min(i.quantity + 1, i.stock || 99) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1, stock: item.stock || 99 }] };
        });
      },
      removeItem: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i
          ),
        }));
      },
      clearCart: () => set({ items: [] }),
      setIsOpen: (open) => set({ isOpen: open }),
      total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "cart-storage" }
  )
);

// Types for DB queries
export type ProductWithVariantsAndImages = Product & {
  variants: (ProductVariant & { images: ProductImage[] })[];
  images: ProductImage[];
};
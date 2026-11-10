"use client";

import { useCartStore } from "@/lib/store";
import Link from "next/link";
import { useState } from "react";

export function CartDrawer() {
  const { items, removeItem, updateQuantity, total, isOpen, setIsOpen } = useCartStore();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-xl transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-serif">Cart ({items.length})</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 flex items-center justify-center hover:bg-nate-grey-100 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-nate-grey-500">Your cart is empty</p>
                <Link
                  href="/shop"
                  className="inline-block mt-4 text-accent hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  Continue Shopping
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.variantId} className="flex gap-4">
                    <div className="w-20 h-20 bg-nate-grey-200 rounded-lg shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-nate-grey-400 text-xs">No Image</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{item.name}</h3>
                      {item.variantLabel && (
                        <p className="text-xs text-nate-grey-500 truncate">{item.variantLabel}</p>
                      )}
                      <p className="text-sm flex items-baseline gap-1.5">
                        <span className={item.isSpecial ? "price-special font-semibold" : "text-nate-grey-500"}>
                          ₹{item.price.toFixed(2)}
                        </span>
                        {item.isSpecial && item.mrp != null && item.mrp > item.price && (
                          <span className="text-xs text-nate-grey-400 line-through">
                            ₹{item.mrp.toFixed(2)}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.variantId, Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 flex items-center justify-center border rounded hover:bg-nate-grey-100"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center border rounded hover:bg-nate-grey-100"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="ml-auto text-nate-grey-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="p-6 border-t bg-nate-grey-50">
              <div className="flex justify-between mb-4">
                <span className="font-medium">Subtotal</span>
                <span className="font-semibold">₹{total().toFixed(2)}</span>
              </div>
              <p className="text-xs text-nate-grey-500 mb-4">
                Shipping calculated at checkout
              </p>
              <Link
                href="/checkout"
                className="block w-full bg-nate-grey-800 text-white text-center py-3 rounded-lg font-medium hover:bg-nate-grey-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                className="block w-full text-center mt-2 text-sm text-nate-grey-500 hover:text-accent"
                onClick={() => setIsOpen(false)}
              >
                View Cart
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
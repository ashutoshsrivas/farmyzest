"use client";

import Link from "next/link";
import { useCartStore } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, total } = useCartStore();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-serif mb-4">Your Cart is Empty</h1>
          <p className="text-nate-grey-500 mb-8">Add some products to get started</p>
          <Link
            href="/shop"
            className="inline-block bg-nate-grey-800 text-white px-8 py-4 rounded-lg hover:bg-nate-grey-700 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-serif mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-4 bg-white p-4 rounded-lg">
                <div className="w-24 h-24 bg-nate-grey-200 rounded-lg shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-nate-grey-400 text-xs">No Image</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  {item.variantLabel && (
                    <p className="text-xs text-nate-grey-500 mt-0.5">{item.variantLabel}</p>
                  )}
                  <p className="text-sm flex items-baseline gap-1.5 mt-1">
                    <span className={item.isSpecial ? "price-special font-semibold" : "text-nate-grey-500"}>
                      ₹{item.price.toFixed(2)}
                    </span>
                    {item.isSpecial && item.mrp != null && item.mrp > item.price && (
                      <span className="text-xs text-nate-grey-400 line-through">
                        ₹{item.mrp.toFixed(2)}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center border rounded">
                      <button
                        onClick={() => updateQuantity(item.variantId, Math.max(1, item.quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center hover:bg-nate-grey-100"
                      >
                        -
                      </button>
                      <span className="w-10 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-nate-grey-100"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-nate-grey-500 hover:text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${item.isSpecial ? "price-special" : ""}`}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}

            <button
              onClick={clearCart}
              className="text-nate-grey-500 hover:text-red-500 text-sm"
            >
              Clear Cart
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg h-fit sticky top-24">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-nate-grey-500">Subtotal</span>
                <span>₹{total().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nate-grey-500">Shipping</span>
                <span>Free</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>₹{total().toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => router.push("/checkout")}
              className="w-full mt-6 bg-nate-grey-800 text-white py-4 rounded-lg font-medium hover:bg-nate-grey-700 transition-colors"
            >
              Proceed to Checkout
            </button>
            <Link
              href="/shop"
              className="block w-full mt-3 text-center text-sm text-nate-grey-500 hover:text-accent"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
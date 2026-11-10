"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/store";

// Clears the cart once we land on the payment-success page. Kept off the
// pre-payment path so an abandoned/failed PayU attempt leaves the cart intact
// for an easy retry.
export function ClearCart() {
  const { clearCart } = useCartStore();
  useEffect(() => {
    clearCart();
  }, [clearCart]);
  return null;
}

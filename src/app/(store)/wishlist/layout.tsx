import type { Metadata } from "next";

// Browser-tab title for the wishlist page (the page itself is a client component,
// which can't export metadata — so it lives here in a thin server layout).
export const metadata: Metadata = { title: "Wishlist — Farmyzest" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

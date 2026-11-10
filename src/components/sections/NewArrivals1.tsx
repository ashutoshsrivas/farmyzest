"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ui/ProductCard";

type Product = {
  id: string;
  slug: string;
  name: string;
  onlinePrice: number;
  imageUrl: string;
  categoryName?: string;
  /** Computed server-side as createdAt within the last 7 days. */
  isNew?: boolean;
};

type NewArrivals1Props = {
  products?: Product[];
};

export function NewArrivals1({ products }: NewArrivals1Props) {
  // Hide the row until the catalogue has products (no demo placeholders).
  if (!products?.length) return null;
  const displayProducts: Product[] = products;

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
        <div className="flex items-end justify-between mb-12 pb-6 border-b border-grey-300">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-grey-500 mb-2">Fresh In</p>
            <h2
              className="font-serif text-grey-900 leading-tight tracking-[-0.01em]"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
            >
              Just Landed
            </h2>
          </div>
          <Link
            href="/shop?sort=newest"
            className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-grey-600 hover:text-grey-900 transition-colors border-b border-grey-300 pb-0.5 hover:border-grey-900"
          >
            View All
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {displayProducts.slice(0, 4).map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              slug={product.slug}
              name={product.name}
              price={product.onlinePrice}
              imageUrl={product.imageUrl}
              categoryName={product.categoryName}
              isNew={product.isNew ?? false}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
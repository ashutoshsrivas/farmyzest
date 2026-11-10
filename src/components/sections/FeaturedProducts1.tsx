"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ui/ProductCard";

type Product = {
  id: string;
  slug: string;
  name: string;
  onlinePrice: number;
  comparePrice?: number | null;
  imageUrl: string;
  categoryName?: string;
  isNew?: boolean;
};

type FeaturedProducts1Props = {
  products?: Product[];
};

export function FeaturedProducts1({ products }: FeaturedProducts1Props) {
  // Hide the row until the catalogue has products (no demo placeholders).
  if (!products?.length) return null;
  const displayProducts = products;

  return (
    <section className="py-20 md:py-28 bg-nado">
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
        <div className="flex items-end justify-between mb-12 pb-6 border-b border-grey-300">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-grey-500 mb-2">Bestsellers</p>
            <h2
              className="font-serif text-grey-900 leading-tight tracking-[-0.01em]"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
            >
              Gardeners&apos; Favourites
            </h2>
          </div>
          <Link
            href="/shop"
            className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-grey-600 hover:text-grey-900 transition-colors border-b border-grey-300 pb-0.5 hover:border-grey-900"
          >
            Explore All
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {displayProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              id={product.id}
              slug={product.slug}
              name={product.name}
              price={product.onlinePrice}
              comparePrice={product.comparePrice}
              imageUrl={product.imageUrl}
              categoryName={product.categoryName}
              isNew={product.isNew}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
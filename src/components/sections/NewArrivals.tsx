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

type NewArrivalsProps = {
  products?: Product[];
};

export function NewArrivals({ products }: NewArrivalsProps) {
  const displayProducts: Product[] = products?.length
    ? products
    : Array.from({ length: 6 }).map((_, i) => ({
        id: `new-${i}`,
        slug: "demo-product",
        name: "Linen Blend Shirt",
        onlinePrice: 1899,
        imageUrl: "",
        categoryName: "Clothing",
        isNew: false,
      }));

  return (
    <section className="py-16 md:py-24 bg-nate-grey-100">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="flex items-end justify-between mb-12">
          <div>
            <span className="text-xs uppercase tracking-widest text-accent font-medium">Just landed</span>
            <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800 mt-2">New Arrivals</h2>
          </div>
          <Link
            href="/shop?sort=newest"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-nate-grey-600 hover:text-nate-grey-800 transition-colors group"
          >
            See All New
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Horizontal scroll on mobile */}
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 -mx-4 px-4 md:overflow-visible md:grid md:grid-cols-3 md:mx-0 md:px-0 scrollbar-hide">
          {displayProducts.map((product, index) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-[70%] md:w-auto animate-fade-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <ProductCard
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={product.onlinePrice}
                imageUrl={product.imageUrl}
                categoryName={product.categoryName}
                isNew={product.isNew ?? false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
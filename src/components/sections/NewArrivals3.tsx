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

type NewArrivals3Props = {
  products?: Product[];
};

export function NewArrivals3({ products }: NewArrivals3Props) {
  const displayProducts: Product[] = products?.length
    ? products
    : Array.from({ length: 6 }).map((_, i) => ({
        id: `demo-${i}`,
        slug: "demo-product",
        name: "New Arrival Item",
        onlinePrice: 1999,
        imageUrl: "",
        categoryName: "Clothing",
        isNew: false,
      }));

  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between mb-12">
          <div>
            <span className="text-sm uppercase tracking-widest text-accent font-medium">Just Dropped</span>
            <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800 mt-2">New Arrivals</h2>
          </div>
          <Link
            href="/shop?sort=newest"
            className="px-6 py-2.5 border border-nate-grey-300 text-nate-grey-600 text-sm font-medium rounded-full hover:border-nate-grey-800 hover:text-nate-grey-800 transition-all"
          >
            See All New
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {displayProducts.map((product) => (
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
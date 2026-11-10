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

type NewArrivals2Props = {
  products?: Product[];
};

export function NewArrivals2({ products }: NewArrivals2Props) {
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
    <section className="py-16 md:py-24 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">New This Week</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
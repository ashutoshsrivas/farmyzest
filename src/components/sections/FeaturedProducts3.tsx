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

type FeaturedProducts3Props = {
  products?: Product[];
};

export function FeaturedProducts3({ products }: FeaturedProducts3Props) {
  const displayProducts = products?.length
    ? products
    : Array.from({ length: 8 }).map((_, i) => ({
        id: `demo-${i}`,
        slug: "demo-product",
        name: "Premium Cotton T-Shirt",
        onlinePrice: 2499,
        comparePrice: 3999,
        imageUrl: "",
        categoryName: "Clothing",
        isNew: i < 2,
      }));

  return (
    <section className="py-20 md:py-32 bg-nate-grey-800">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-white">Featured</h2>
          <Link
            href="/shop"
            className="text-sm font-medium text-accent hover:text-white transition-colors"
          >
            See All
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
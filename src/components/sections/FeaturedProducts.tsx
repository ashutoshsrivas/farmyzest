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

type FeaturedProductsProps = {
  products?: Product[];
};

export function FeaturedProducts({ products }: FeaturedProductsProps) {
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
    <section className="py-16 md:py-24 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">Featured</h2>
            <p className="mt-2 text-nate-grey-500">Handpicked styles just for you</p>
          </div>
          <Link
            href="/shop"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-nate-grey-600 hover:text-nate-grey-800 transition-colors group"
          >
            View All
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 stagger-children">
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

        <div className="mt-10 text-center md:hidden">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-medium text-nate-grey-600 hover:text-nate-grey-800 transition-colors"
          >
            View All Products
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
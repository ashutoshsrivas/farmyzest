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

type FeaturedProducts2Props = {
  products?: Product[];
};

export function FeaturedProducts2({ products }: FeaturedProducts2Props) {
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
    <section className="py-16 md:py-24 bg-nate-grey-100">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">The Edit</h2>
          <p className="mt-2 text-nate-grey-500">Handpicked styles for you</p>
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

        <div className="text-center mt-12">
          <Link
            href="/shop"
            className="inline-block px-8 py-3.5 border-2 border-nate-grey-800 text-nate-grey-800 font-medium rounded-full hover:bg-nate-grey-800 hover:text-white transition-all duration-300"
          >
            Shop All
          </Link>
        </div>
      </div>
    </section>
  );
}
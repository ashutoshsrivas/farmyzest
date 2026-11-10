"use client";

import Link from "next/link";
import Image from "next/image";

type Category = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

type CategoryShowcase2Props = {
  categories?: Category[];
};

export function CategoryShowcase2({ categories }: CategoryShowcase2Props) {
  const displayCategories = categories?.length ? categories : [];

  if (displayCategories.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-nate-grey-800">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-white">Shop by Category</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {displayCategories.map((category) => (
            <Link
              key={category.slug}
              href={`/shop?category=${category.slug}`}
              className="group text-center"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl mb-4">
                <div className="absolute inset-0 bg-nate-grey-700">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full bg-nate-grey-600" />
                  )}
                </div>
                <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="text-white font-medium">{category.name}</h3>
              {category.productCount !== undefined && (
                <p className="text-sm text-white/50 mt-1">{category.productCount} products</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
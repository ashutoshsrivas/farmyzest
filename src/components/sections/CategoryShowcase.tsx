"use client";

import Link from "next/link";
import Image from "next/image";

type Category = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

type CategoryShowcaseProps = {
  categories?: Category[];
};

const defaultCategories = [
  { name: "Clothing", slug: "clothing", imageUrl: "", productCount: 0 },
  { name: "Shoes", slug: "shoes", imageUrl: "", productCount: 0 },
  { name: "Accessories", slug: "accessories", imageUrl: "", productCount: 0 },
];

export function CategoryShowcase({ categories }: CategoryShowcaseProps) {
  const displayCategories = categories?.length ? categories : defaultCategories;

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">Shop by Category</h2>
          <p className="mt-3 text-nate-grey-500">Find exactly what you&apos;re looking for</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayCategories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/shop?category=${category.slug}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-nate-grey-300">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-nate-grey-200 to-nate-grey-300 flex items-center justify-center">
                    <span className="text-nate-grey-500 font-serif text-lg">{category.name}</span>
                  </div>
                )}
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-nate-grey-800/60 via-transparent to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="text-xl font-serif">{category.name}</h3>
                {category.productCount !== undefined && (
                  <p className="text-sm text-white/70 mt-1">{category.productCount} products</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
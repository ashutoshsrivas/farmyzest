"use client";

import Link from "next/link";
import Image from "next/image";

type Category = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

type CategoryShowcase3Props = {
  categories?: Category[];
};

export function CategoryShowcase3({ categories }: CategoryShowcase3Props) {
  const displayCategories = categories?.length ? categories : [];

  if (displayCategories.length === 0) return null;

  return (
    <section className="py-20 md:py-32 bg-nate-grey-100">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">Categories</h2>
        </div>

        <div className="flex flex-wrap gap-4">
          {displayCategories.map((category) => (
            <Link
              key={category.slug}
              href={`/shop?category=${category.slug}`}
              className="group flex-1 min-w-[200px] relative aspect-[4/3] overflow-hidden rounded-2xl"
            >
              <div className="absolute inset-0 bg-nate-grey-300">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-nate-grey-200 to-nate-grey-400" />
                )}
              </div>
              <div className="absolute inset-0 bg-nate-grey-900/40 group-hover:bg-nate-grey-900/60 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-xl font-serif text-white">{category.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
"use client";

import Link from "next/link";

type Category = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

type CategoryShowcase1Props = {
  categories?: Category[];
};

export function CategoryShowcase1({ categories }: CategoryShowcase1Props) {
  // If no categories are provided (e.g. fresh DB, no products yet) we hide
  // the entire section rather than rendering Women/Men/Accessories that
  // don't exist in this catalog. The previous fallback made dead links.
  if (!categories?.length) return null;

  const displayCategories = categories;

  return (
    <section className="py-20 md:py-28 bg-nado">
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">

        {/* Section header */}
        <div className="flex items-end justify-between mb-10 pb-6 border-b border-grey-300">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-grey-500 mb-2">Browse</p>
            <h2
              className="font-serif text-grey-900 leading-tight tracking-[-0.01em]"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
            >
              Shop by Department
            </h2>
          </div>
        </div>

        {/* Category grid — bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[180px] md:auto-rows-[200px]">
          {displayCategories.map((category, i) => (
            <Link
              key={category.slug}
              href={`/shop?category=${category.slug}`}
              className={`group relative overflow-hidden ${
                i === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              {/* Background */}
              <div className="absolute inset-0 bg-grey-300">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full bg-grey-300" />
                )}
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

              {/* Text */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <h3
                  className="font-serif text-white leading-none tracking-tight text-lg md:text-xl"
                >
                  {category.name}
                </h3>
                <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-white/60 mt-2 flex items-center gap-2 group-hover:gap-4 transition-all duration-300">
                  Discover
                  <span>→</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
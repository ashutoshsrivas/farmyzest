"use client";

import Link from "next/link";
import Image from "next/image";

type Collection = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

type FeaturedCollectionsProps = {
  collections?: Collection[];
};

export function FeaturedCollections({ collections }: FeaturedCollectionsProps) {
  const displayCollections = collections?.length ? collections : [];

  if (displayCollections.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-serif text-nate-grey-800">Featured Collections</h2>
        </div>

        <div className={`grid gap-4 ${displayCollections.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          displayCollections.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          displayCollections.length >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}`}>
          {displayCollections.slice(0, 3).map((collection, index) => (
            <Link
              key={collection.slug}
              href={`/shop?collection=${collection.slug}`}
              className="group relative overflow-hidden rounded-xl aspect-[4/3]"
            >
              <div className="absolute inset-0 bg-nate-grey-300">
                {collection.imageUrl ? (
                  <Image
                    src={collection.imageUrl}
                    alt={collection.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-nate-grey-200 to-nate-grey-400" />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-nate-grey-900/70 via-nate-grey-900/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <h3 className="text-lg font-serif">{collection.name}</h3>
                {collection.productCount !== undefined && (
                  <p className="text-xs text-white/70 mt-1">{collection.productCount} products</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
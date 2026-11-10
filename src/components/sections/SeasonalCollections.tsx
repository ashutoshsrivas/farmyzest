"use client";

import Link from "next/link";
import Image from "next/image";

type CollectionCardProps = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

export function CollectionCard({ name, slug, imageUrl, productCount }: CollectionCardProps) {
  return (
    <Link
      href={`/shop?collection=${slug}`}
      className="group block relative aspect-[4/5] overflow-hidden rounded-2xl"
    >
      <div className="absolute inset-0 bg-nate-grey-300">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-nate-grey-200 to-nate-grey-300" />
        )}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-nate-grey-800/70 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h3 className="text-2xl font-serif mb-1">{name}</h3>
        {productCount !== undefined && (
          <p className="text-sm text-white/70">{productCount} products</p>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm font-medium">
          <span>Explore</span>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

type SeasonalCollectionsProps = {
  collections?: Array<{
    name: string;
    slug: string;
    imageUrl?: string;
    productCount?: number;
  }>;
};

export function SeasonalCollections({ collections }: SeasonalCollectionsProps) {
  const defaultCollections = [
    {
      name: "Summer Collection",
      slug: "summer",
      imageUrl: "",
      productCount: 0,
    },
    {
      name: "Winter Collection",
      slug: "winter",
      imageUrl: "",
      productCount: 0,
    },
  ];

  const displayCollections = collections?.length ? collections : defaultCollections;

  return (
    <section className="py-16 md:py-24">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">Shop by Season</h2>
          <p className="mt-3 text-nate-grey-500 max-w-md mx-auto">
            Curated collections for every time of year
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {displayCollections.map((collection, index) => (
            <div
              key={collection.slug}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CollectionCard
                name={collection.name}
                slug={collection.slug}
                imageUrl={collection.imageUrl}
                productCount={collection.productCount}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
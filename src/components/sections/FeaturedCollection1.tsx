"use client";

import Link from "next/link";
import Image from "next/image";

type FeaturedCollectionProps = {
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  mainImage: string;
  thumbnails: string[];
};

export function FeaturedCollection1({
  title,
  description,
  ctaText,
  ctaLink,
  mainImage,
  thumbnails,
}: FeaturedCollectionProps) {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12 lg:gap-20 items-center">

          {/* Left: Main image — tall, no radius */}
          <div className="relative aspect-[3/4] overflow-hidden order-1">
            {mainImage ? (
              <Image
                src={mainImage}
                alt={title}
                fill
                className="object-cover transition-transform duration-700 hover:scale-[1.02]"
              />
            ) : (
              <div className="w-full h-full bg-grey-200" />
            )}
          </div>

          {/* Right: Editorial content */}
          <div className="order-2 lg:pl-8">
            <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-grey-500 mb-6">
              Featured Collection
            </p>
            <h2
              className="font-serif text-grey-900 leading-[1.05] tracking-[-0.01em] mb-8"
              style={{ fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
            >
              {title}
            </h2>
            <p className="text-sm font-sans font-light text-grey-600 leading-[1.75] mb-10 max-w-sm">
              {description}
            </p>
            <Link
              href={ctaLink}
              className="inline-block px-8 py-4 bg-grey-900 text-white text-xs font-sans font-medium uppercase tracking-[0.12em] hover:bg-grey-700 transition-colors duration-300"
            >
              {ctaText}
            </Link>

            {/* Thumbnails grid */}
            {thumbnails.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-12">
                {thumbnails.map((thumb, index) => (
                  <div key={index} className="relative aspect-square overflow-hidden bg-grey-100">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={`${title} ${index + 1}`}
                        fill
                        className="object-cover transition-transform duration-500 hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="w-full h-full bg-grey-200" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

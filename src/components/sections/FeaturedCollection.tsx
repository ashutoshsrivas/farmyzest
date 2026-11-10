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

export function FeaturedCollection({
  title,
  description,
  ctaText,
  ctaLink,
  mainImage,
  thumbnails,
}: FeaturedCollectionProps) {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: Thumbnails grid */}
          <div className="grid grid-cols-3 gap-4 order-2 lg:order-1">
            <div className="col-span-3 grid grid-cols-3 gap-4">
              {thumbnails.map((thumb, index) => (
                <div
                  key={index}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg bg-nate-grey-200"
                >
                  <Image
                    src={thumb}
                    alt={`${title} item ${index + 1}`}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Main image */}
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-nate-grey-200 order-1 lg:order-2">
            <Image
              src={mainImage}
              alt={title}
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* Text content below images */}
        <div className="mt-12 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-800">{title}</h2>
          <p className="mt-4 text-nate-grey-600 leading-relaxed">{description}</p>
          <Link
            href={ctaLink}
            className="inline-flex items-center gap-2 mt-6 px-8 py-3 bg-nate-grey-800 text-white font-medium rounded-full hover:bg-nate-grey-700 transition-colors"
          >
            {ctaText}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
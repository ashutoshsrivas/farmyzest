"use client";

import Link from "next/link";
import Image from "next/image";

type FeaturedCollection2Props = {
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  mainImage: string;
  thumbnails: string[];
};

export function FeaturedCollection2({
  title,
  description,
  ctaText,
  ctaLink,
  mainImage,
  thumbnails,
}: FeaturedCollection2Props) {
  return (
    <section className="py-16 md:py-24 bg-nate-grey-800">
      <div className="w-full px-6 md:px-12 lg:px-16">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-sm uppercase tracking-widest text-accent font-medium">
            Curated Selection
          </span>
          <h2 className="text-4xl md:text-5xl font-serif text-white mt-4">
            {title}
          </h2>
        </div>

        {/* Images Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="relative aspect-[3/4] rounded-lg overflow-hidden md:col-span-2 md:row-span-2">
            <Image
              src={mainImage}
              alt={title}
              fill
              className="object-cover"
            />
          </div>
          {thumbnails.map((thumb, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden"
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

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <p className="text-white/70 text-center max-w-lg">
            {description}
          </p>
          <Link
            href={ctaLink}
            className="px-8 py-3.5 border-2 border-accent text-accent font-medium rounded-full hover:bg-accent hover:text-white transition-all duration-300 whitespace-nowrap"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </section>
  );
}

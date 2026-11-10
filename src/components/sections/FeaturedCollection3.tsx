"use client";

import Link from "next/link";
import Image from "next/image";

type FeaturedCollection3Props = {
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  mainImage: string;
  thumbnails: string[];
};

export function FeaturedCollection3({
  title,
  description,
  ctaText,
  ctaLink,
  mainImage,
  thumbnails,
}: FeaturedCollection3Props) {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        {/* Stacked horizontal layout */}
        <div className="space-y-4">
          {/* Main Feature - Full Width */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="relative h-64 lg:h-96 lg:col-span-2 rounded-2xl overflow-hidden bg-nate-grey-200">
              <Image
                src={mainImage}
                alt={title}
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-nate-grey-800/80" />
              <div className="absolute bottom-0 left-0 p-8">
                <span className="text-sm uppercase tracking-widest text-white/60">New Season</span>
                <h3 className="text-3xl md:text-4xl font-serif text-white mt-2">{title}</h3>
              </div>
            </div>

            {/* Text Sidebar */}
            <div className="flex flex-col justify-center bg-nate-grey-100 rounded-2xl p-8">
              <p className="text-nate-grey-600 leading-relaxed mb-6">
                {description}
              </p>
              <Link
                href={ctaLink}
                className="inline-flex items-center gap-2 text-accent font-medium hover:gap-4 transition-all"
              >
                {ctaText}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Thumbnails Row */}
          <div className="grid grid-cols-3 gap-4">
            {thumbnails.map((thumb, index) => (
              <div
                key={index}
                className="relative h-48 rounded-xl overflow-hidden bg-nate-grey-200"
              >
                <Image
                  src={thumb}
                  alt={`${title} item ${index + 1}`}
                  fill
                  className="object-cover hover:scale-110 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

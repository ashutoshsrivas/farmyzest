"use client";

import Link from "next/link";
import Image from "next/image";

type Hero2Props = {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  backgroundImage?: string;
};

export function Hero2({
  title = "Curated for You",
  subtitle = "Premium fashion essentials that define your unique style",
  ctaText = "Explore",
  ctaLink = "/shop",
  backgroundImage,
}: Hero2Props) {
  return (
    <section className="min-h-screen flex">
      {/* Left: Text Content */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-12 lg:px-16 py-20 bg-white">
        <div className="max-w-xl">
          <span className="text-sm uppercase tracking-widest text-accent font-medium">
            New Season
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif mt-4 mb-6 text-nate-grey-800 leading-tight">
            {title}
          </h1>
          <p className="text-lg text-nate-grey-600 mb-8 leading-relaxed">
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href={ctaLink}
              className="px-8 py-3.5 bg-accent text-white font-medium rounded-full hover:bg-accent-dark transition-all duration-300 text-center"
            >
              {ctaText}
            </Link>
            <Link
              href="/about"
              className="px-8 py-3.5 border-2 border-nate-grey-800 text-nate-grey-800 font-medium rounded-full hover:bg-nate-grey-800 hover:text-white transition-all duration-300 text-center"
            >
              Our Story
            </Link>
          </div>
        </div>
      </div>

      {/* Right: Hero Image */}
      <div className="hidden lg:block w-1/2 relative">
        {backgroundImage ? (
          <Image
            src={backgroundImage}
            alt="Hero"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-nate-grey-300" />
        )}
      </div>
    </section>
  );
}

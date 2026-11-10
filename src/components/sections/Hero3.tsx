"use client";

import Link from "next/link";
import Image from "next/image";

type Hero3Props = {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  backgroundImage?: string;
};

export function Hero3({
  title = "Elevate",
  subtitle = "Fashion that speaks without words",
  ctaText = "Discover",
  ctaLink = "/shop",
  backgroundImage,
}: Hero3Props) {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-nate-grey-800">
      {/* Background Image */}
      <div className="absolute inset-0">
        {backgroundImage ? (
          <Image
            src={backgroundImage}
            alt="Hero"
            fill
            className="object-cover opacity-30"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-nate-grey-800 to-nate-grey-700" />
        )}
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-accent/20 rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 border border-accent/10 rounded-full" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <h1 className="text-7xl sm:text-8xl md:text-9xl lg:text-[12rem] font-serif text-white mb-8 leading-none tracking-tight">
          {title}
        </h1>
        <p className="text-xl text-white/60 mb-12 uppercase tracking-[0.2em]">
          {subtitle}
        </p>
        <Link
          href={ctaLink}
          className="inline-block px-12 py-5 bg-white text-nate-grey-800 font-medium text-lg rounded-full hover:bg-accent hover:text-white transition-all duration-300"
        >
          {ctaText}
        </Link>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <div className="text-white/40 text-sm uppercase tracking-widest">Scroll</div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";

type HeroProps = {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  backgroundImage?: string;
};

export function Hero({
  title = "Elevate Your Style",
  subtitle = "Discover curated fashion that speaks to who you are",
  ctaText = "Shop Collection",
  ctaLink = "/shop",
  backgroundImage,
}: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        {backgroundImage ? (
          <Image
            src={backgroundImage}
            alt="Hero"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-nate-grey-100 via-nate-grey-200 to-nate-grey-300" />
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-nate-grey-900/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-12 lg:px-16 text-center text-white">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-serif leading-tight tracking-tight animate-fade-up">
          {title}
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-xl mx-auto animate-fade-up" style={{ animationDelay: "100ms" }}>
          {subtitle}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <Link
            href={ctaLink}
            className="px-8 py-3.5 bg-white text-nate-grey-800 font-medium rounded-full hover:bg-nate-grey-100 transition-all duration-300 shadow-lg"
          >
            {ctaText}
          </Link>
          <Link
            href="/about"
            className="px-8 py-3.5 bg-transparent border border-white text-white font-medium rounded-full hover:bg-white/10 transition-all duration-300"
          >
            Our Story
          </Link>
        </div>
      </div>
    </section>
  );
}
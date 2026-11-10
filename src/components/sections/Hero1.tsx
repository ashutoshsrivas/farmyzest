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

export function Hero1({
  title = "Grow Something Beautiful",
  subtitle = "Plants, seeds, plant care, tools and machinery — your one-stop garden & farm store since 1962",
  ctaText = "Shop Now",
  ctaLink = "/shop",
  backgroundImage,
}: HeroProps) {
  return (
    <section className="relative h-screen min-h-[600px] flex items-end overflow-hidden -mt-[72px] md:-mt-20">
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
          <div className="w-full h-full bg-grey-900" />
        )}
        {/* Dark gradient bottom-up for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-grey-900/80 via-grey-900/25 to-black/10" />
      </div>

      {/* Content — bottom-left editorial layout */}
      <div className="relative z-10 w-full px-6 md:px-12 lg:px-20 xl:px-24 pb-16 md:pb-24">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60 font-sans mb-5 animate-fade-up">
            Farmyzest · Nidhi Enterprises · Est. 1962
          </p>
          <h1
            className="font-serif text-white leading-[0.95] tracking-[-0.02em] animate-fade-up"
            style={{
              fontSize: "clamp(3.5rem, 8vw, 7rem)",
              animationDelay: "80ms",
            }}
          >
            {title}
          </h1>
          <p
            className="mt-5 text-white/70 font-sans font-light leading-relaxed max-w-sm animate-fade-up"
            style={{ fontSize: "clamp(0.9rem, 1.2vw, 1.05rem)", animationDelay: "160ms" }}
          >
            {subtitle}
          </p>
          <div
            className="mt-8 flex items-center gap-4 animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href={ctaLink}
              className="px-8 py-4 bg-white text-grey-900 text-xs font-sans font-medium uppercase tracking-[0.12em] hover:bg-grey-100 transition-colors duration-300"
            >
              {ctaText}
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 bg-transparent border border-white/60 text-white text-xs font-sans font-medium uppercase tracking-[0.12em] hover:border-white hover:bg-white/10 transition-colors duration-300"
            >
              Our Story
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-8 md:right-12 lg:right-20 xl:right-24 flex flex-col items-center gap-2 animate-fade-up" style={{ animationDelay: "400ms" }}>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-sans writing-mode-vertical rotate-90 origin-center">Scroll</span>
        <div className="w-px h-10 bg-white/20 overflow-hidden">
          <div className="w-full h-1/2 bg-white/60 animate-[slideDown_2s_ease-in-out_infinite]" />
        </div>
      </div>
    </section>
  );
}

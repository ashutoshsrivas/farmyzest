"use client";

import Image from "next/image";
import Link from "next/link";

type BrandStory3Props = {
  backgroundImage?: string;
};

export function BrandStory3({ backgroundImage }: BrandStory3Props) {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden">
      {/* Background Image */}
      {backgroundImage && (
        <div className="absolute inset-0">
          <Image
            src={backgroundImage}
            alt="Our Story"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-nate-grey-800/80" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-12 lg:px-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl md:text-7xl font-serif text-white mb-8">
            Style That Speaks Without Words
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            At Farmyzest, we believe fashion is more than fabric — it&apos;s a statement of identity.
            Every piece is carefully curated to offer you apparel that balances modern design with timeless elegance.
          </p>
          <Link
            href="/about"
            className="inline-block px-10 py-4 border border-white text-white font-medium rounded-full hover:bg-white hover:text-nate-grey-800 transition-all duration-300"
          >
            Our Story
          </Link>
        </div>
      </div>
    </section>
  );
}
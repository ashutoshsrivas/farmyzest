"use client";

import Image from "next/image";
import Link from "next/link";

type BrandStory2Props = {
  backgroundImage?: string;
};

export function BrandStory2({ backgroundImage }: BrandStory2Props) {
  return (
    <section className="py-20 md:py-32 bg-nate-grey-800">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <div>
            <span className="text-sm uppercase tracking-widest text-accent font-medium">
              Our Story
            </span>
            <h2 className="text-4xl md:text-5xl font-serif text-white mt-4 mb-8">
              Style That Speaks Without Words
            </h2>
            <div className="space-y-6 text-nate-grey-400 leading-relaxed">
              <p>
                At Farmyzest, we believe fashion is more than fabric — it&apos;s a statement of identity.
                Every piece in our collection is carefully curated to offer you apparel that balances
                modern design with timeless elegance.
              </p>
              <p>
                Whether you&apos;re dressing for the boardroom, a weekend getaway, or a casual evening out,
                our collections are designed to make you feel confident and authentic.
              </p>
            </div>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-accent text-white font-medium rounded-full hover:bg-accent-dark transition-all"
            >
              Discover More
            </Link>
          </div>

          {/* Image */}
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden">
            {backgroundImage ? (
              <Image
                src={backgroundImage}
                alt="Our Story"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-nate-grey-700 to-nate-grey-600" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
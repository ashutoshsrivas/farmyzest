"use client";

import Image from "next/image";
import Link from "next/link";

type BrandStory1Props = {
  backgroundImage?: string;
};

export function BrandStory1({ backgroundImage }: BrandStory1Props) {
  return (
    <section className="bg-grey-900 py-20 md:py-32">
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Left: Content */}
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-white/40 mb-6">
              Our Story
            </p>
            <h2
              className="font-serif text-white leading-[1.05] tracking-[-0.02em] mb-8"
              style={{ fontSize: "clamp(2.25rem, 4vw, 3.75rem)" }}
            >
              Rooted in the Soil Since 1962
            </h2>
            <div className="space-y-5 text-sm font-sans font-light text-white/60 leading-[1.8] max-w-md">
              <p>
                For over six decades, Nidhi Enterprises has supplied gardeners, nurseries
                and farmers with everything they need to grow — from seeds and saplings to
                manures, fertilisers, crop protection, spray pumps and power machinery.
              </p>
              <p>
                Farmyzest brings that same counter-side expertise online: genuine products,
                honest advice, and one place for every garden and field need.
              </p>
            </div>
            <Link
              href="/about"
              className="inline-block mt-10 text-xs font-sans font-medium uppercase tracking-[0.2em] text-white border-b border-white/30 pb-1 hover:border-white transition-colors duration-300"
            >
              Discover Our Story
            </Link>
          </div>

          {/* Right: Image */}
          <div className="relative aspect-[3/4] overflow-hidden order-first lg:order-last">
            {backgroundImage ? (
              <Image
                src={backgroundImage}
                alt="Our Story"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-grey-800" />
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
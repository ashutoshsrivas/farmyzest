"use client";

import Image from "next/image";
import Link from "next/link";

type BrandStoryProps = {
  backgroundImage?: string;
};

export function BrandStory({ backgroundImage }: BrandStoryProps) {
  return (
    <section className="py-16 md:py-24 bg-nate-grey-800 text-white">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <div className="animate-fade-up">
            <span className="text-xs uppercase tracking-widest text-accent font-medium">Our Story</span>
            <h2 className="text-3xl md:text-4xl font-serif mt-3 mb-6 leading-tight">
              Style That Speaks<br />Without Words
            </h2>
            <p className="text-nate-grey-400 leading-relaxed mb-6">
              At Farmyzest, we believe fashion is more than fabric — it&apos;s a statement of identity.
              Every piece in our collection is carefully curated to offer you apparel that balances
              modern design with timeless elegance.
            </p>
            <p className="text-nate-grey-400 leading-relaxed mb-8">
              Whether you&apos;re dressing for the boardroom, a weekend getaway, or a casual evening out,
              our collections are designed to make you feel confident and authentic. We source from
              trusted suppliers and focus on quality that lasts season after season.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-accent transition-colors group"
            >
              Learn more about us
              <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Image */}
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: "150ms" }}>
            {backgroundImage ? (
              <Image
                src={backgroundImage}
                alt="Our Story"
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-nate-grey-700 to-nate-grey-600">
                <div className="absolute inset-0 opacity-20">
                  <div className="w-full h-full" style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, var(--color-accent) 1px, transparent 1px)`,
                    backgroundSize: '30px 30px'
                  }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl font-serif text-white/30">SS</div>
                    <div className="text-sm text-white/30 mt-2 tracking-widest">SINCE 2007</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
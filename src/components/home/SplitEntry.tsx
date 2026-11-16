import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SegmentLink } from "@/components/segment/SegmentLink";
import { ImageSlot } from "./ImageSlot";
import { WRAP } from "./ui";
import { INTRO, SPLIT } from "@/lib/home-content";
import type { Segment } from "@/lib/segment";

export interface SplitCategory {
  name: string;
  slug: string;
  count: number;
}

function Panel({ seg, active, categories }: { seg: Segment; active: boolean; categories: SplitCategory[] }) {
  const c = SPLIT[seg];
  return (
    // Each panel carries its own segment so Garden stays clay and Farm olive
    // whichever side the shopper has selected.
    <article data-segment={seg} className="flex h-full flex-col bg-seg-tint border border-rule min-w-0">
      <div className="flex flex-col gap-3 p-5 pb-4 md:p-7 md:pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="cat-label text-seg-ink">{c.title}</span>
          {active && <span className="cat-label !text-[0.65rem] text-stone">You&apos;re browsing</span>}
        </div>
        <h2 className="font-serif text-[1.9rem] md:text-[2.4rem] leading-[1.05] tracking-[-0.015em] text-balance">{c.headline}</h2>
      </div>
      <ImageSlot slot={c.image} priority sizes="(max-width: 768px) 100vw, 50vw" />
      <div className="flex flex-1 flex-col gap-4 p-5 md:p-7">
        <p className="text-base text-stone max-w-[46ch]">{c.body}</p>

        {categories.length > 0 && (
          <ul className="border-t border-rule">
            {categories.map((cat) => (
              <li key={cat.slug} className="border-b border-rule">
                <SegmentLink
                  segment={seg}
                  href={`/shop?category=${cat.slug}`}
                  className="group flex min-h-12 items-center justify-between gap-3 text-[17px] hover:text-seg-ink"
                >
                  <span>{cat.name}</span>
                  <span className="flex items-center gap-3">
                    {cat.count > 0 && <span className="font-mono text-xs text-stone tabular-nums">{cat.count}</span>}
                    <ArrowRight className="w-4 h-4 text-seg-ink transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                  </span>
                </SegmentLink>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap gap-3 pt-2">
          <SegmentLink
            segment={seg}
            href={`/shop?segment=${seg}`}
            className="inline-flex min-h-12 items-center px-6 bg-seg-ink text-bone text-[15px] font-medium hover:bg-accent-dark transition-colors"
          >
            {c.cta}
          </SegmentLink>
          {c.secondary && (
            <Link
              href={c.secondary.href}
              className="inline-flex min-h-12 items-center px-6 border border-seg-ink text-seg-ink text-[15px] font-medium hover:bg-seg-tint transition-colors"
            >
              {c.secondary.label}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Homepage opener: one line of intro, then Garden and Farm side by side. */
export function SplitEntry({ segment, categories }: { segment: Segment; categories: Record<Segment, SplitCategory[]> }) {
  // The selected side comes first on mobile (stacked); desktop keeps Garden left.
  const order: Segment[] = segment === "farm" ? ["farm", "garden"] : ["garden", "farm"];
  return (
    <section className={`${WRAP} pt-7 md:pt-10 pb-14 md:pb-20`}>
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] md:items-end mb-6 md:mb-8">
        <div>
          <p className="cat-label text-stone">{INTRO.eyebrow}</p>
          <h1 className="mt-3 font-serif text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.05] tracking-[-0.02em] text-balance">
            {INTRO.headline}
          </h1>
        </div>
        <p className="text-[17px] text-stone max-w-[44ch] md:justify-self-end">{INTRO.body}</p>
      </div>
      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        {order.map((s) => (
          <div key={s} className={`min-w-0 ${s === "garden" ? "md:order-1" : "md:order-2"}`}>
            <Panel seg={s} active={s === segment} categories={categories[s]} />
          </div>
        ))}
      </div>
    </section>
  );
}

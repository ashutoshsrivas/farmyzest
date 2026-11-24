import { Photo } from "./Photo";
import { ArrowRight } from "lucide-react";
import { SegmentLink } from "@/components/segment/SegmentLink";
import { Seal } from "./Botanicals";
import { HERO } from "@/lib/home-content";
import type { QuickNavItem, Segment } from "@/lib/segment";

/**
 * Full-bleed opener: Garden and Farm as two photo panels. Hovering one widens
 * it; the whole panel links to that side of the shop, with category chips on top.
 */
export function HeroSplit({ segment, quickNav }: { segment: Segment; quickNav: Record<Segment, QuickNavItem[]> }) {
  const order: Segment[] = segment === "farm" ? ["farm", "garden"] : ["garden", "farm"];
  return (
    <section className="relative bg-moss" aria-label="Choose Garden or Farm">
      <div className="hero-split flex flex-col md:flex-row md:h-[min(84svh,820px)] md:min-h-[560px]">
        {order.map((seg, idx) => {
          const h = HERO[seg];
          const active = seg === segment;
          return (
            <div
              key={seg}
              data-segment={seg}
              className={`hero-panel group relative flex flex-col overflow-hidden min-h-[480px] sm:min-h-[540px] md:min-h-0 ${seg === "garden" ? "md:order-1" : "md:order-2"}`}
            >
              {/* Photo: slow zoom on load, gentle push on hover. */}
              <div className="absolute inset-0 ken-burns">
                <Photo
                  src={h.image}
                  alt={h.alt}
                  fill
                  priority={idx === 0}
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-cover transition-transform duration-[1.8s] ease-[var(--ease-calm)] group-hover:scale-[1.06]"
                />
              </div>
              <div className="absolute inset-0 bg-[#121810]/50 transition-colors duration-700 group-hover:bg-[#121810]/40" />

              {/* Whole-panel link sits under the content. */}
              <SegmentLink segment={seg} href={`/shop?segment=${seg}`} className="absolute inset-0 z-10" aria-label={h.cta}>
                <span className="sr-only">{h.cta}</span>
              </SegmentLink>

              <div className="pointer-events-none relative z-20 flex flex-1 flex-col justify-end p-6 pb-8 sm:p-10 lg:p-14 text-bone [text-shadow:0_1px_18px_rgba(10,14,9,0.45)]">
                <div className="flex items-center gap-3 rise" style={{ animationDelay: `${200 + idx * 150}ms` }}>
                  <span className="cat-label bg-seg-ink px-2.5 py-1 text-bone">{h.kicker}</span>
                  {active && <span className="cat-label !text-[0.66rem] text-bone/75">You&apos;re browsing</span>}
                </div>
                <h2
                  className="rise mt-4 max-w-[13ch] font-serif text-[2.6rem] leading-[0.98] tracking-[-0.025em] sm:text-[3.4rem] lg:text-[4.4rem] text-balance"
                  style={{ animationDelay: `${350 + idx * 150}ms` }}
                >
                  {h.headline}
                </h2>
                <p className="rise mt-4 max-w-[40ch] text-[17px] text-bone/85" style={{ animationDelay: `${500 + idx * 150}ms` }}>
                  {h.body}
                </p>
                {quickNav[seg].length > 0 && (
                  <ul className="rise pointer-events-auto mt-6 flex flex-wrap gap-2" style={{ animationDelay: `${650 + idx * 150}ms` }}>
                    {quickNav[seg].map((c) => (
                      <li key={c.slug}>
                        <SegmentLink
                          segment={seg}
                          href={`/shop?category=${c.slug}`}
                          className="inline-flex min-h-10 items-center border border-bone/40 bg-[#121810]/30 px-3.5 text-sm text-bone backdrop-blur-[2px] transition-colors hover:bg-bone hover:text-charcoal"
                        >
                          {c.name}
                        </SegmentLink>
                      </li>
                    ))}
                  </ul>
                )}
                <span
                  className="rise mt-7 inline-flex w-fit items-center gap-3 text-[15px] font-medium"
                  style={{ animationDelay: `${800 + idx * 150}ms` }}
                >
                  <span className="inline-flex h-12 items-center bg-bone px-6 text-charcoal transition-colors group-hover:bg-seg-ink group-hover:text-bone">
                    {h.cta}
                  </span>
                  <ArrowRight className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-1.5" strokeWidth={1.5} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-8 z-30 hidden -translate-x-1/2 xl:block">
        <Seal className="shadow-[0_0_0_6px_rgba(251,248,242,0.22)]" />
      </div>
    </section>
  );
}

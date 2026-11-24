import Link from "next/link";
import { Reveal } from "./Reveal";
import { Sprig } from "./Botanicals";
import { CountUp } from "./CountUp";
import { WRAP } from "./ui";
import type { HomeContent } from "@/lib/home-content";

/** Brand statement with a hand-drawn sprig and a few true numbers. */
export function Intro({
  content,
  departments,
  categories,
  years,
}: {
  content: HomeContent["intro"];
  departments: number;
  categories: number;
  years: number;
}) {
  return (
    <section className={`${WRAP} relative py-16 md:py-24`}>
      <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-14 items-start">
        <Reveal className="hidden md:block text-seg">
          <Sprig className="h-56 w-28 lg:h-64 lg:w-32" />
        </Reveal>
        <div>
          <Reveal>
            {content.eyebrow && <p className="cat-label text-stone">{content.eyebrow}</p>}
            <p className="mt-4 max-w-[24ch] font-serif text-[2.1rem] leading-[1.08] tracking-[-0.02em] sm:text-[2.8rem] lg:text-[3.6rem] text-balance">
              {content.statement}
            </p>
          </Reveal>
          {content.showStats && (
          <Reveal delay={150} className="mt-10 grid max-w-3xl grid-cols-3 border-t border-charcoal">
            {[
              { n: years, label: "years trading" },
              { n: departments, label: "departments" },
              { n: categories, label: "categories" },
            ].map((s, i) => (
              <div key={s.label} className={`pt-5 ${i > 0 ? "border-l border-rule pl-4 sm:pl-6" : ""}`}>
                <CountUp to={s.n} className="block font-serif text-[2.4rem] leading-none sm:text-[3.2rem]" />
                <span className="mt-2 block text-sm text-stone">{s.label}</span>
              </div>
            ))}
          </Reveal>
          )}
          {content.linkLabel && content.linkHref && (
            <Reveal delay={250} className="mt-8">
              <Link href={content.linkHref} className="text-[15px] underline decoration-1 underline-offset-4 hover:text-seg-ink">
                {content.linkLabel}
              </Link>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

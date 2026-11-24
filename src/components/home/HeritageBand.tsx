import { Photo } from "./Photo";
import Link from "next/link";
import type { HomeContent } from "@/lib/home-content";
import { CountUp } from "./CountUp";
import { Reveal } from "./Reveal";
import { WRAP } from "./ui";

/** Full-bleed photo band: 1962 to today, from confirmed facts only. */
export function HeritageBand({ number, years, content: HERITAGE }: { number: string; years: number; content: HomeContent["heritage"] }) {
  return (
    <section className="relative overflow-hidden bg-moss text-bone">
      {HERITAGE.image && <Photo src={HERITAGE.image} alt={HERITAGE.imageAlt} fill sizes="100vw" className="parallax-img object-cover" />}
      <div className="absolute inset-0 bg-[#121810]/60" />
      <div className={`${WRAP} relative py-20 md:py-28`}>
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div className="min-w-0">
            <Reveal>
              <p className="cat-label text-bone/70">{number} · {HERITAGE.title}</p>
              <p className="mt-4 font-serif text-[5.5rem] leading-[0.85] tracking-[-0.04em] sm:text-[8rem] lg:text-[11rem]">{HERITAGE.bigYear}</p>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-6 max-w-[36ch] font-serif text-[1.4rem] leading-snug text-bone/90 md:text-[1.7rem] text-pretty">{HERITAGE.body}</p>
            </Reveal>
            <Reveal delay={250} className="mt-8 flex flex-wrap items-center gap-6">
              <Link href="/about" className="inline-flex min-h-12 items-center bg-bone px-6 text-[15px] font-medium text-moss hover:bg-parchment">
                {HERITAGE.linkLabel || "Read our story"}
              </Link>
              <span className="text-bone/80">
                <CountUp to={years} className="font-serif text-3xl text-bone" /> years of trading
              </span>
            </Reveal>
          </div>
          <div className="min-w-0">
            <Reveal delay={200} className="relative mx-auto max-w-sm md:ml-auto md:mr-0">
              <div className="relative aspect-[4/5] rotate-[2deg] overflow-hidden border-[10px] border-bone shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
                {HERITAGE.inset && <Photo src={HERITAGE.inset} alt={HERITAGE.insetAlt} fill sizes="(max-width: 768px) 80vw, 30vw" className="object-cover" />}
              </div>
            </Reveal>
            <ol className="mt-10 border-t border-bone/30">
              {HERITAGE.milestones.map((m, i) => (
                <Reveal as="li" key={m.year} delay={300 + i * 100} className="grid grid-cols-[88px_1fr] items-baseline gap-4 border-b border-bone/30 py-4">
                  <span className="font-serif text-[1.8rem] leading-none">{m.year}</span>
                  <span className="text-[16px] text-bone/85">{m.text}</span>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

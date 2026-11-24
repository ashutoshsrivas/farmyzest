import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { seasonFor, SOWING_IMAGE } from "@/lib/home-content";
import { Reveal } from "./Reveal";
import { SeedHead } from "./Botanicals";
import { SectionHead, WRAP } from "./ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Month-aware sowing list beside a large field photo. */
export function SowThisMonth({ number }: { number: string }) {
  const month = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "numeric" }));
  const season = seasonFor(month);
  return (
    <section className={`${WRAP} pb-16 md:pb-24`}>
      <SectionHead number={number} title={`What to sow in ${MONTHS[month - 1]}`} link={{ label: "All seeds", href: "/shop?category=seeds" }} />
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <Reveal className="relative min-h-[320px] overflow-hidden bg-moss sm:min-h-[420px]">
          <Image src={SOWING_IMAGE.src} alt={SOWING_IMAGE.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="parallax-img object-cover" />
          <div className="absolute inset-0 bg-[#121810]/35" />
          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 text-bone">
            <SeedHead className="h-20 w-20 text-bone/80" />
            <div>
              <p className="cat-label text-bone/75">{season.name} · {season.window}</p>
              <p className="mt-2 font-serif text-[3.2rem] leading-none tracking-[-0.02em] sm:text-[4.6rem]">{MONTHS[month - 1]}</p>
              <p className="mt-4 max-w-[42ch] text-[15px] text-bone/85">
                Dates are for the North Indian plains. Hill and southern gardens differ, so ask us if you&apos;re unsure.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="min-w-0">
          <ul className="border-t border-charcoal">
            {season.crops.map((c, i) => (
              <Reveal as="li" key={c.name} delay={i * 60} className="border-b border-rule">
                <Link
                  href={`/shop?category=seeds&q=${encodeURIComponent(c.q)}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-3 py-3.5 sm:grid-cols-[1.2fr_1fr_auto]"
                >
                  <span className="min-w-0">
                    <span className="text-[17px] group-hover:text-seg-ink">{c.name}</span>
                    {c.local && <span className="ml-2 font-serif text-[15px] italic text-stone">{c.local}</span>}
                  </span>
                  <span className="hidden text-[15px] text-stone sm:block">{c.how}</span>
                  <ArrowRight className="h-4 w-4 text-seg-ink transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                </Link>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={200} className="mt-6 bg-seg-tint p-5">
            <p className="cat-label text-stone">Flowers to sow now</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {season.flowers.map((f) => (
                <Link
                  key={f}
                  href={`/shop?category=flower-seeds&q=${encodeURIComponent(f)}`}
                  className="inline-flex min-h-10 items-center border border-seg-ink/40 bg-bone px-4 font-serif text-lg hover:bg-seg-ink hover:text-bone transition-colors"
                >
                  {f}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { HERITAGE } from "@/lib/home-content";
import { ImageSlot } from "./ImageSlot";
import { SectionHead, WRAP } from "./ui";

/** 1962 to today, from confirmed facts only (see HERITAGE in home-content). */
export function HeritageBand({ number }: { number: string }) {
  return (
    <section className="bg-moss text-bone">
      <div className={`${WRAP} py-14 md:py-20`}>
        <SectionHead number={number} title="1962 to today" tone="dark" />
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-start">
          <div className="space-y-8 min-w-0">
            <p className="font-serif text-[1.45rem] md:text-[1.75rem] leading-snug text-bone/90 max-w-[34ch] text-pretty">{HERITAGE.body}</p>
            <ol className="border-t border-bone/25">
              {HERITAGE.milestones.map((m) => (
                <li key={m.year} className="grid grid-cols-[96px_1fr] gap-4 border-b border-bone/25 py-4 items-baseline">
                  <span className="font-serif text-[2rem] leading-none tabular-nums">{m.year}</span>
                  <span className="text-[17px] text-bone/80">{m.text}</span>
                </li>
              ))}
            </ol>
            <Link href="/about" className="inline-flex min-h-12 items-center px-6 border border-bone/50 text-[15px] hover:bg-bone hover:text-moss transition-colors">
              Read our story
            </Link>
          </div>
          {/* Placeholder sits on the dark band, so give it the parchment ground. */}
          <div data-segment="garden" className="text-charcoal">
            <ImageSlot slot={HERITAGE.image} sizes="(max-width: 768px) 100vw, 45vw" className="md:max-w-md md:ml-auto" />
          </div>
        </div>
      </div>
    </section>
  );
}

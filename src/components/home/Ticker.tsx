import { TICKER } from "@/lib/home-content";

function Leaf() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-seg" fill="currentColor" aria-hidden="true">
      <path d="M20 4C11 4 5 9 5 16c0 1.3.3 2.6.8 3.7C7.4 14.6 11 10.8 16 8.6c-4 2.7-7 6.4-8.4 11 1 .3 2 .4 3 .4 6.6 0 10.4-6.2 9.4-16Z" />
    </svg>
  );
}

/** Slow-moving strip of what we stock. Pauses on hover; static for reduced motion. */
export function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="marquee-track overflow-hidden border-y border-rule bg-bone py-4" aria-label="What we stock">
      <ul className="animate-marquee flex w-max items-center gap-8" style={{ ["--marquee-duration" as string]: "48s" }}>
        {items.map((t, i) => (
          <li key={i} aria-hidden={i >= TICKER.length} className="flex items-center gap-8 whitespace-nowrap font-serif text-[1.35rem] md:text-[1.6rem] text-charcoal">
            {t}
            <Leaf />
          </li>
        ))}
      </ul>
    </div>
  );
}

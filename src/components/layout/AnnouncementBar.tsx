"use client";

// Site-wide running bar of live offers, shown directly beneath the nav on every
// storefront page. Pure CSS marquee (see .animate-marquee in globals.css) — two
// identical tracks so the loop is seamless; hover pauses it.

// Current offers. Edit this list to change what runs across the bar.
const OFFERS = [
  "Free delivery on orders above ₹999",
  "Since 1962 — trusted by gardeners & farmers",
  "Seeds · Plants · Fertilisers · Tools · Machinery",
  "Expert advice on call & WhatsApp",
];

export function AnnouncementBar() {
  // One "run" of every offer, separated by a diamond. Rendered twice for the loop.
  const run = (
    <div className="flex shrink-0 items-center">
      {OFFERS.map((offer, i) => (
        <span key={i} className="flex items-center">
          <span className="px-6 text-[11px] font-medium uppercase tracking-[0.18em] whitespace-nowrap">
            {offer}
          </span>
          <span aria-hidden className="text-white/40">
            &#9670;
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee-track flex h-9 items-center overflow-hidden border-t border-white/10 bg-grey-900 text-white">
      <div className="animate-marquee flex w-max">
        {run}
        {run}
      </div>
    </div>
  );
}

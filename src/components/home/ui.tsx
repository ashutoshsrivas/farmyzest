import Link from "next/link";
import { Reveal } from "./Reveal";

/** Page-width container used by every homepage section. */
export const WRAP = "mx-auto w-full max-w-[var(--w-content)] px-4 sm:px-6 lg:px-10";

/** Section opener: catalogue number, serif title, optional link on the right. */
export function SectionHead({
  number,
  title,
  intro,
  link,
  tone = "light",
}: {
  number: string;
  title: string;
  intro?: string;
  link?: { label: string; href: string };
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <Reveal className={`mb-8 grid gap-3 border-t pt-5 md:mb-10 md:grid-cols-[96px_1fr_auto] md:items-baseline ${dark ? "border-bone/40 text-bone" : "border-charcoal"}`}>
      <span className={`cat-label ${dark ? "text-bone/70" : "text-stone"}`}>{number}</span>
      <div className="min-w-0">
        <h2 className="font-serif text-[2rem] leading-[1.05] tracking-[-0.015em] md:text-[2.8rem] text-balance">{title}</h2>
        {intro && <p className={`mt-2 max-w-[60ch] text-base ${dark ? "text-bone/80" : "text-stone"}`}>{intro}</p>}
      </div>
      {link && (
        <Link href={link.href} className={`text-[15px] underline decoration-1 underline-offset-4 ${dark ? "text-bone" : "text-charcoal hover:text-seg-ink"}`}>
          {link.label}
        </Link>
      )}
    </Reveal>
  );
}

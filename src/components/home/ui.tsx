import Link from "next/link";

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
  const muted = tone === "dark" ? "text-bone/60" : "text-stone";
  return (
    <div className={`grid gap-3 md:grid-cols-[96px_1fr_auto] md:items-baseline border-t pt-5 mb-8 md:mb-10 ${tone === "dark" ? "border-bone/25" : "border-charcoal"}`}>
      <span className={`cat-label ${muted}`}>{number}</span>
      <div className="min-w-0">
        <h2 className="font-serif text-[1.85rem] md:text-[2.4rem] leading-[1.1] tracking-[-0.01em] text-balance">{title}</h2>
        {intro && <p className={`mt-2 max-w-[60ch] text-base ${muted}`}>{intro}</p>}
      </div>
      {link && (
        <Link href={link.href} className={`text-[15px] underline underline-offset-4 decoration-1 hover:text-seg-ink ${tone === "dark" ? "text-bone" : "text-charcoal"}`}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

import Link from "next/link";
import { NEEDS } from "@/lib/home-content";
import { SectionHead, WRAP } from "./ui";

/** Problem-first entry points. Horizontal scroll on phones, six columns on desktop. */
export function NeedRow({ number }: { number: string }) {
  return (
    <section className={`${WRAP} pb-14 md:pb-20`}>
      <SectionHead number={number} title="Shop by need" intro="Start from the job in front of you." />
      {/* Hairline grid: 1px gaps over a rule-coloured ground. */}
      <ul className="flex gap-px overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-3 lg:grid-cols-6 bg-rule border border-rule">
        {NEEDS.map((n, i) => (
          <li key={n.title} className="snap-start shrink-0 w-[64%] sm:w-auto bg-seg-surface">
            <Link href={n.href} className="group flex h-full min-h-40 flex-col gap-2 p-4 md:p-5 hover:bg-seg-tint transition-colors duration-300">
              <span className="font-mono text-xs text-stone tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif text-xl leading-tight group-hover:text-seg-ink">{n.title}</span>
              <span className="text-[15px] text-stone">{n.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

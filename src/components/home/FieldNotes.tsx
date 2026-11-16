import Link from "next/link";
import { FIELD_NOTES } from "@/lib/home-content";
import { SectionHead, WRAP } from "./ui";

/** Short, practical buying notes — each ends at the relevant shelf. */
export function FieldNotes({ number }: { number: string }) {
  return (
    <section className={`${WRAP} py-14 md:py-20`}>
      <SectionHead number={number} title="Field notes" intro="Quick answers to the questions we hear most at the counter." />
      <div className="grid gap-px bg-rule border border-rule md:grid-cols-3">
        {FIELD_NOTES.map((n, i) => (
          <article key={n.title} className="flex flex-col gap-3 bg-seg-surface p-5 md:p-6">
            <span className="font-mono text-xs text-stone">Note {String(i + 1).padStart(2, "0")}</span>
            <h3 className="font-serif text-[1.45rem] leading-tight">{n.title}</h3>
            <p className="text-base text-charcoal/85 leading-relaxed">{n.body}</p>
            <Link href={n.link.href} className="mt-auto pt-2 text-[15px] text-seg-ink underline underline-offset-4 decoration-1">
              Shop {n.link.label.toLowerCase()}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

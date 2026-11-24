import { Photo } from "./Photo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FIELD_NOTES } from "@/lib/home-content";
import { Reveal } from "./Reveal";
import { SectionHead, WRAP } from "./ui";

/** Short, practical buying notes with a photo each. */
export function FieldNotes({ number }: { number: string }) {
  return (
    <section className={`${WRAP} py-16 md:py-24`}>
      <SectionHead number={number} title="Field notes" intro="Quick answers to the questions we hear most at the counter." />
      <div className="grid gap-6 md:grid-cols-3">
        {FIELD_NOTES.map((n, i) => (
          <Reveal as="article" key={n.title} delay={i * 120} className="group flex flex-col bg-bone">
            <div className="relative aspect-[16/10] overflow-hidden bg-sand">
              <Photo
                src={n.image}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-calm)] group-hover:scale-[1.06]"
              />
              <span className="absolute left-3 top-3 bg-bone px-2 py-1 font-mono text-xs text-charcoal">Note {String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 border-x border-b border-rule p-5 md:p-6">
              <h3 className="font-serif text-[1.5rem] leading-tight">{n.title}</h3>
              <p className="text-base leading-relaxed text-charcoal/85">{n.body}</p>
              <Link href={n.link.href} className="mt-auto inline-flex items-center gap-2 pt-2 text-[15px] font-medium text-seg-ink">
                Shop {n.link.label.toLowerCase()}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

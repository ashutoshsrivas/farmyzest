import Link from "next/link";
import { SectionHead, WRAP } from "./ui";
import type { Segment } from "@/lib/segment";

export interface IndexDept {
  name: string;
  slug: string;
  segment: "GARDEN" | "FARM" | "BOTH";
  children: { name: string; slug: string }[];
}

const TAG: Record<IndexDept["segment"], string> = { GARDEN: "Garden", FARM: "Farm", BOTH: "Garden · Farm" };

/** Every department, laid out like the index of a seed catalogue. */
export function CatalogueIndex({ departments, segment, number }: { departments: IndexDept[]; segment: Segment; number: string }) {
  if (!departments.length) return null;
  // Departments for the chosen side first, keeping admin order within each group.
  const want = segment === "farm" ? "FARM" : "GARDEN";
  const sorted = [...departments].sort((a, b) => Number(b.segment === want) - Number(a.segment === want));
  return (
    <section className={`${WRAP} pb-14 md:pb-20`}>
      <SectionHead number={number} title="The full catalogue" link={{ label: "Shop everything", href: "/shop" }} />
      <ol className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((d, i) => (
          <li key={d.slug} className="border-b border-rule py-5 min-w-0">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-stone tabular-nums w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <Link href={`/shop?category=${d.slug}`} className="font-serif text-[1.35rem] leading-tight hover:text-seg-ink">
                {d.name}
              </Link>
              <span className="ml-auto cat-label !text-[0.62rem] text-stone whitespace-nowrap">{TAG[d.segment]}</span>
            </div>
            {d.children.length > 0 && (
              <p className="mt-2 pl-9 text-[15px] leading-relaxed text-stone">
                {d.children.map((c, j) => (
                  <span key={c.slug}>
                    <Link href={`/shop?category=${c.slug}`} className="hover:text-charcoal underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                    {j < d.children.length - 1 && <span aria-hidden="true"> · </span>}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

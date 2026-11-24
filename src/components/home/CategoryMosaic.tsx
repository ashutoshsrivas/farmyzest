import { Photo } from "./Photo";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHead, WRAP } from "./ui";
import type { Segment } from "@/lib/segment";

export interface MosaicDept {
  name: string;
  slug: string;
  segment: "GARDEN" | "FARM" | "BOTH";
  image: string | null;
  children: { name: string; slug: string }[];
}

const TAG: Record<MosaicDept["segment"], string> = { GARDEN: "Garden", FARM: "Farm", BOTH: "Garden · Farm" };

/** Every department as a photo tile; the first one large. Sub-categories slide up on hover. */
export function CategoryMosaic({ departments, segment, number }: { departments: MosaicDept[]; segment: Segment; number: string }) {
  if (!departments.length) return null;
  const want = segment === "farm" ? "FARM" : "GARDEN";
  const sorted = [...departments].sort((a, b) => Number(b.segment === want) - Number(a.segment === want));
  return (
    <section className={`${WRAP} pb-16 md:pb-24`}>
      <SectionHead number={number} title="Shop the full catalogue" link={{ label: "Shop everything", href: "/shop" }} />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:auto-rows-[230px] lg:auto-rows-[260px]">
        {sorted.map((d, i) => (
          <Reveal
            as="li"
            key={d.slug}
            delay={(i % 4) * 90}
            className={`${i === 0 ? "col-span-2 md:row-span-2" : ""} min-w-0`}
          >
            <Link
              href={`/shop?category=${d.slug}`}
              className={`group relative block h-full overflow-hidden bg-moss ${i === 0 ? "aspect-[4/3] md:aspect-auto" : "aspect-square md:aspect-auto"}`}
            >
              {d.image && (
                <Photo
                  src={d.image}
                  alt=""
                  fill
                  sizes={i === 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
                  className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-calm)] group-hover:scale-[1.07]"
                />
              )}
              <div className="absolute inset-0 bg-[#121810]/35 transition-colors duration-500 group-hover:bg-[#121810]/55" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5 text-bone">
                <span className="cat-label !text-[0.62rem] text-bone/75">{TAG[d.segment]}</span>
                <span className={`mt-1 flex items-end justify-between gap-2 font-serif leading-[1.05] ${i === 0 ? "text-[1.9rem] sm:text-[2.6rem]" : "text-[1.2rem] sm:text-[1.5rem]"}`}>
                  {d.name}
                  <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" strokeWidth={1.5} />
                </span>
                {d.children.length > 0 && (
                  <span
                    className={`hidden md:block overflow-hidden text-sm text-bone/85 transition-all duration-500 ${
                      i === 0 ? "mt-3 max-h-20" : "max-h-0 opacity-0 group-hover:mt-2 group-hover:max-h-20 group-hover:opacity-100"
                    }`}
                  >
                    {d.children.slice(0, 5).map((c) => c.name).join(" · ")}
                  </span>
                )}
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

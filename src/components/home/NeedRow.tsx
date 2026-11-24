import Link from "next/link";
import { Photo } from "./Photo";
import { Reveal } from "./Reveal";
import { SectionHead, WRAP } from "./ui";
import type { ShopNeedCard } from "@/lib/shop-needs";

/** Problem-first entry points (admin → Shop by need) as photo cards. Swipe on phones, grid on desktop. */
export function NeedRow({
  number,
  needs,
  title,
  intro,
  tone = "light",
}: {
  number: string;
  needs: ShopNeedCard[];
  title: string;
  intro?: string;
  tone?: "light" | "dark";
}) {
  if (!needs.length) return null;
  const cols = needs.length >= 6 ? "lg:grid-cols-6" : needs.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <section className={`${WRAP} relative pb-16 md:pb-24`}>
      <SectionHead number={number} title={title} intro={intro} tone={tone} />
      <ul className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 ${cols}`}>
        {needs.map((n, i) => (
          <Reveal as="li" key={n.id} delay={i * 80} className="flex w-[68%] shrink-0 snap-start sm:w-auto">
            <Link href={n.href} className="lift group flex w-full flex-col">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                {n.imageUrl && (
                  <Photo
                    src={n.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 68vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-calm)] group-hover:scale-[1.08]"
                  />
                )}
                <div className="absolute inset-0 bg-[#121810]/20 transition-colors duration-500 group-hover:bg-[#121810]/5" />
                <span className="absolute left-3 top-3 font-mono text-xs text-bone">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="flex-1 border-x border-b border-rule bg-bone px-3 py-3 text-charcoal transition-colors duration-300 group-hover:bg-seg-tint">
                <span className="block font-serif text-[1.25rem] leading-tight group-hover:text-seg-ink">{n.title}</span>
                {n.body && <span className="mt-1 block text-sm text-stone">{n.body}</span>}
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

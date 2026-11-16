import Link from "next/link";
import { seasonFor } from "@/lib/home-content";
import { SectionHead, WRAP } from "./ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Month-aware sowing list (North Indian plains), linking each crop to seed search. */
export function SowThisMonth({ number }: { number: string }) {
  const month = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "numeric" }));
  const season = seasonFor(month);
  return (
    <section className={`${WRAP} pb-14 md:pb-20`}>
      <SectionHead
        number={number}
        title={`What to sow in ${MONTHS[month - 1]}`}
        intro={`${season.name}, ${season.window}. Dates are for the North Indian plains; hill and southern gardens differ, so ask us if you're unsure.`}
        link={{ label: "All seeds", href: "/shop?category=seeds" }}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[300px] border-collapse text-left">
            <thead>
              <tr className="border-b border-charcoal">
                <th className="cat-label text-stone font-normal py-2 pr-4">Vegetable</th>
                <th className="cat-label text-stone font-normal py-2 pr-4">How to sow</th>
                <th className="py-2"><span className="sr-only">Seeds</span></th>
              </tr>
            </thead>
            <tbody>
              {season.crops.map((c) => (
                <tr key={c.name} className="border-b border-rule">
                  <td className="py-3 pr-4">
                    <span className="text-[17px]">{c.name}</span>
                    {c.local && <span className="ml-2 text-[15px] italic text-stone font-serif">{c.local}</span>}
                  </td>
                  <td className="py-3 pr-4 text-[15px] text-stone">{c.how}</td>
                  <td className="py-3 text-right">
                    <Link href={`/shop?category=seeds&q=${encodeURIComponent(c.q)}`} className="text-[15px] text-seg-ink underline underline-offset-4 decoration-1 whitespace-nowrap">
                      Find seeds
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="border border-rule bg-bone/70 p-5 self-start">
          <p className="cat-label text-stone">Flowers to sow now</p>
          <ul className="mt-3 space-y-2">
            {season.flowers.map((f) => (
              <li key={f}>
                <Link href={`/shop?category=flower-seeds&q=${encodeURIComponent(f)}`} className="font-serif text-xl hover:text-seg-ink">
                  {f}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

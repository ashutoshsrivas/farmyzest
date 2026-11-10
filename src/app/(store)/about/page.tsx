// src/app/(store)/about/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sprout, Leaf, Wrench, ShieldCheck } from "lucide-react";
import { STORE_EMAIL, STORE_PHONE } from "@/lib/company";
import { PLACEHOLDER } from "@/lib/placeholder-images";

export const metadata: Metadata = {
  title: "About Farmyzest — Nidhi Enterprises, Est. 1962",
  description:
    "Farmyzest is the online store of Nidhi Enterprises, established in 1962 — a one-stop shop for gardening, agricultural and horticultural products: plants, seeds, fertilisers, crop protection, spray pumps, tools and garden machinery.",
};

const RANGE = [
  "Manures & fertilisers",
  "Pesticides, insecticides & fungicides",
  "Herbicides & weedicides",
  "Seeds & plants",
  "Pots & pot stands",
  "Spray pumps (1 L – 16 L) & pressure pumps",
  "Lawn mowers — manual, electric & engine",
  "Hedge trimmers & brush cutters",
  "Battery grass cutters & chainsaws",
  "A complete range of manual garden tools",
];

export default function AboutPage() {
  return (
    <main className="bg-grey-100 min-h-screen font-sans">
      {/* Hero */}
      <section className="relative overflow-hidden bg-grey-900">
        <Image src={PLACEHOLDER.story} alt="" fill className="object-cover opacity-30" priority />
        <div className="relative w-full px-6 md:px-12 lg:px-20 xl:px-24 py-24 md:py-32">
          <p className="text-leaf-light text-xs font-medium tracking-[0.3em] uppercase mb-4">
            Nidhi Enterprises · Est. 1962
          </p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight max-w-3xl">
            Six decades of helping
            <br />
            things <span className="text-leaf-light italic">grow.</span>
          </h1>
          <p className="text-white/70 mt-6 text-lg max-w-xl leading-relaxed">
            Farmyzest is the online home of Nidhi Enterprises — a one-stop solution for every
            gardening, agricultural and horticultural need.
          </p>
        </div>
      </section>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-16 space-y-20 max-w-[1400px] mx-auto">
        {/* Story */}
        <section className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-5 text-grey-700 leading-relaxed text-base">
            <h2 className="font-serif text-3xl text-grey-900">Our Story</h2>
            <p>
              Since <strong>1962</strong>, <strong className="text-grey-900">Nidhi Enterprises</strong> has
              served home gardeners, nurseries, landscapers and farmers from behind the same trusted
              counter. Three generations of customers have come to us for good seed, the right
              fertiliser for the season, and honest advice on what will actually work in their soil.
            </p>
            <p>
              Over the years our range has grown from manures and spray pumps to a complete garden and
              farm store — plants, pots, crop protection, hand tools and power machinery from
              dependable brands.
            </p>
            <p>
              <strong className="text-grey-900">Farmyzest</strong> brings that experience online, so you
              can order everything your garden or field needs and still get the advice that has kept
              our customers coming back for more than sixty years.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-grey-200 p-8">
            <h3 className="font-serif text-xl text-grey-900 mb-5">What we stock</h3>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-grey-700">
              {RANGE.map((item) => (
                <li key={item} className="flex gap-2">
                  <Leaf className="w-4 h-4 mt-0.5 shrink-0 text-leaf" strokeWidth={1.75} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/shop"
              className="inline-block mt-8 px-6 py-3 bg-accent text-white text-xs font-medium uppercase tracking-[0.12em] hover:bg-accent-dark transition-colors"
            >
              Browse the store
            </Link>
          </div>
        </section>

        {/* Pillars */}
        <section>
          <h2 className="font-serif text-3xl text-grey-900 mb-8 text-center">Why gardeners trust us</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Sprout, title: "Since 1962", desc: "Over sixty years supplying growers — we know what works, season after season." },
              { icon: ShieldCheck, title: "Genuine products", desc: "Authentic seeds, fertilisers, chemicals and machinery sourced from trusted brands." },
              { icon: Wrench, title: "Tools to machinery", desc: "From a hand trowel to an engine brush cutter — one store for the whole job." },
              { icon: Leaf, title: "Expert advice", desc: "Not sure what your plants need? Call or message us and we’ll help you choose." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-grey-200 rounded-xl p-6">
                <div className="w-10 h-10 rounded-full bg-leaf-light flex items-center justify-center">
                  <Icon className="w-5 h-5 text-accent" strokeWidth={1.75} />
                </div>
                <h3 className="font-serif text-lg text-grey-900 mt-4 mb-2">{title}</h3>
                <p className="text-grey-600 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-grey-900 rounded-2xl p-8 md:p-12 text-center text-white space-y-4">
          <h2 className="font-serif text-3xl">Need help choosing?</h2>
          <p className="text-white/70 max-w-lg mx-auto leading-relaxed">
            Questions about a product, dosage, or which machine suits your garden? We&apos;re happy to help.
          </p>
          <p className="text-sm text-white/80">
            <a href={`tel:${STORE_PHONE.replace(/\s/g, "")}`} className="underline underline-offset-4">{STORE_PHONE}</a>
            {"  ·  "}
            <a href={`mailto:${STORE_EMAIL}`} className="underline underline-offset-4">{STORE_EMAIL}</a>
          </p>
        </section>
      </div>
    </main>
  );
}

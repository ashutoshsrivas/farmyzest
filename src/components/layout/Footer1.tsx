"use client";

import Link from "next/link";
import { useState } from "react";

interface FooterCollection {
  name: string;
  slug: string;
  showInFooter?: boolean;
}

export function Footer1({
  collections = [],
}: {
  collections?: FooterCollection[];
}) {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");

  // Admin-curated collections flagged to appear in the footer.
  const footerCollections = collections.filter((c) => c.showInFooter);

  return (
    <footer className="bg-grey-900">

      {/* Newsletter strip */}
      <div className="border-b border-white/10">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-white/40 mb-2">Newsletter</p>
              <h3 className="font-serif text-white text-2xl md:text-3xl">Seasonal Growing Tips</h3>
            </div>
            <form
              className="flex gap-0 max-w-sm w-full"
              onSubmit={(e) => { e.preventDefault(); setEmail(""); }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="flex-1 bg-transparent border border-white/20 border-r-0 px-4 py-3 text-sm font-sans text-white placeholder:text-white/30 outline-none focus:border-white/50 transition-colors"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-white text-grey-900 text-xs font-sans font-medium uppercase tracking-[0.1em] hover:bg-grey-100 transition-colors whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main footer links */}
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-16 md:py-20">
        <div
          className={`grid grid-cols-2 gap-10 ${
            footerCollections.length > 0 ? "md:grid-cols-5" : "md:grid-cols-4"
          }`}
        >

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-serif text-xl text-white uppercase tracking-[0.08em]">
              Farmyzest
            </Link>
            <p className="mt-5 text-xs font-sans font-light text-white/40 leading-relaxed max-w-[200px]">
              By Nidhi Enterprises, Est. 1962. Your one-stop shop for gardening, agricultural and horticultural needs.
            </p>
            <div className="flex gap-5 mt-6">
              <Link href="#" className="text-[10px] font-sans uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">Insta</Link>
              <Link href="#" className="text-[10px] font-sans uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">FB</Link>
              <Link href="#" className="text-[10px] font-sans uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">Pinterest</Link>
            </div>
          </div>

          {/* Columns */}
          {[
            {
              title: "Shop",
              links: [
                { href: "/shop", label: "All Products" },
                { href: "/shop?category=plants", label: "Plants" },
                { href: "/shop?category=seeds", label: "Seeds" },
                { href: "/shop?category=fertilizers-manures", label: "Plant Care" },
                { href: "/shop?category=garden-machinery", label: "Machinery" },
              ],
            },
            {
              title: "Customer",
              links: [
                { href: "/account", label: "My Account" },
                { href: "/account/orders", label: "Orders" },
                { href: "/contact", label: "Contact Us" },
                { href: "/stores", label: "Our Stores" },
              ],
            },
            {
              title: "Information",
              links: [
                { href: "/about", label: "About" },
                { href: "/shipping", label: "Shipping" },
                { href: "/returns", label: "Returns & Exchanges" },
                { href: "/terms", label: "Terms" },
                { href: "/privacy-policy", label: "Privacy" },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-white/40 mb-5">{col.title}</p>
              <ul className="space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-sans font-light text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Collections flagged showInFooter. */}
          {footerCollections.length > 0 && (
            <div>
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-white/40 mb-5">
                Collections
              </p>
              <ul className="space-y-3.5">
                {footerCollections.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/collections/${c.slug}`}
                      className="text-sm font-sans font-light text-white/60 hover:text-white transition-colors"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] font-sans text-white/30">
            © {currentYear} Farmyzest · Nidhi Enterprises. All rights reserved.
          </p>
          <p className="text-[11px] font-sans text-white/20 uppercase tracking-[0.15em]">
            India
          </p>
        </div>
      </div>
    </footer>
  );
}
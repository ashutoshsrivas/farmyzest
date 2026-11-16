"use client";

import Link from "next/link";
import { useState } from "react";
import type { QuickNavItem, Segment } from "@/lib/segment";
import { COMPANY_ESTABLISHED, COMPANY_GSTIN, COMPANY_NAME } from "@/lib/company";

interface FooterCollection {
  name: string;
  slug: string;
  showInFooter?: boolean;
}

interface FooterContact {
  phone: string | null;
  phoneHref: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
}

const linkCls = "text-[15px] text-bone/70 hover:text-bone transition-colors";

function Column({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <div>
      <p className="cat-label text-bone/50 mb-4">{title}</p>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className={linkCls}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer1({
  collections = [],
  quickNav = { garden: [], farm: [] },
  contact,
}: {
  collections?: FooterCollection[];
  quickNav?: Record<Segment, QuickNavItem[]>;
  contact?: FooterContact;
}) {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const footerCollections = collections.filter((c) => c.showInFooter);
  const toLinks = (items: QuickNavItem[]) => items.map((c) => ({ href: `/shop?category=${c.slug}`, label: c.name }));

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not sign you up. Please try again.");
      setState("done");
      setEmail("");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not sign you up. Please try again.");
    }
  }

  return (
    <footer className="bg-moss text-bone">
      <div className="mx-auto max-w-[var(--w-content)] px-4 sm:px-6 lg:px-10">
        {/* Sign-up */}
        <div className="grid gap-6 border-b border-bone/15 py-12 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <p className="cat-label text-bone/50">Seasonal notes</p>
            <h2 className="mt-2 font-serif text-[1.75rem] leading-tight md:text-[2.2rem]">
              What to sow, spray and service, once a season.
            </h2>
          </div>
          <form onSubmit={subscribe} className="w-full" noValidate>
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <div className="flex">
              <input
                id="footer-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="min-h-12 flex-1 min-w-0 border border-bone/30 border-r-0 bg-transparent px-4 text-base text-bone placeholder:text-bone/40 outline-none focus:border-bone/70"
              />
              <button
                type="submit"
                disabled={state === "saving"}
                className="min-h-12 bg-bone px-5 text-sm font-medium text-moss hover:bg-parchment disabled:opacity-60 cursor-pointer"
              >
                {state === "saving" ? "Signing up…" : "Sign up"}
              </button>
            </div>
            <p className="mt-2 min-h-5 text-sm" aria-live="polite">
              {state === "done" && <span className="text-bone/80">Thanks. You&apos;re on the list.</span>}
              {state === "error" && <span className="text-[#F2B8A0]">{error}</span>}
            </p>
          </form>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
              Farmyzest
            </Link>
            <p className="cat-label mt-1 text-bone/50">
              {COMPANY_NAME} · Est. {COMPANY_ESTABLISHED}
            </p>
            <div className="mt-5 space-y-1.5 text-[15px] text-bone/70">
              {contact?.address && <p className="max-w-[28ch]">{contact.address}</p>}
              {contact?.phone && contact.phoneHref && (
                <p>
                  <a href={contact.phoneHref} className="hover:text-bone">
                    {contact.phone}
                  </a>
                </p>
              )}
              {contact?.whatsapp && (
                <p>
                  <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-bone">
                    WhatsApp us
                  </a>
                </p>
              )}
              {contact?.email && (
                <p>
                  <a href={`mailto:${contact.email}`} className="hover:text-bone">
                    {contact.email}
                  </a>
                </p>
              )}
            </div>
          </div>
          <Column title="Garden" links={toLinks(quickNav.garden)} />
          <Column title="Farm" links={toLinks(quickNav.farm)} />
          <Column
            title="Help"
            links={[
              { href: "/contact", label: "Contact us" },
              { href: "/account/orders", label: "Your orders" },
              { href: "/shipping", label: "Shipping" },
              { href: "/returns", label: "Returns & exchanges" },
              ...footerCollections.map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
            ]}
          />
          <Column
            title="Company"
            links={[
              { href: "/about", label: "Our story" },
              { href: "/stores", label: "Visit the store" },
              { href: "/terms", label: "Terms" },
              { href: "/privacy-policy", label: "Privacy" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-bone/15 py-6 text-sm text-bone/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {COMPANY_NAME}. Farmyzest is the online store of {COMPANY_NAME}.
          </p>
          {COMPANY_GSTIN && <p className="font-mono text-xs">GSTIN {COMPANY_GSTIN}</p>}
        </div>
      </div>
    </footer>
  );
}

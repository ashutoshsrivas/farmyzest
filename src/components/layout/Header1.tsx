"use client";

import Link from "next/link";
import { Search, ShoppingBag, User, Menu, X, Heart, Star, ChevronDown, Phone, MessageCircle } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useWishlist } from "@/lib/wishlist";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SearchOverlay } from "./SearchOverlay";
import { SegmentSwitch } from "@/components/segment/SegmentSwitch";
import { useSegment } from "@/components/segment/SegmentProvider";
import { COMPANY_ESTABLISHED } from "@/lib/company";
import type { QuickNavItem, Segment } from "@/lib/segment";

interface NavCategory {
  name: string;
  slug: string;
  showInMenu?: boolean;
  menuHighlight?: boolean;
  menuImageUrl?: string | null;
  children?: { name: string; slug: string }[];
}
interface NavCollection {
  name: string;
  slug: string;
  showInHeader?: boolean;
  showInFooter?: boolean;
  rankOnHome?: boolean;
}
interface NavLinkItem {
  label: string;
  href: string;
  newTab?: boolean;
}
interface SpecialPreview {
  slug: string;
  name: string;
  discountPct: number;
  imageUrl: string | null;
}
interface HeaderContact {
  phone: string | null;
  phoneHref: string | null;
  whatsapp: string | null;
}

const SEARCH_HINT: Record<Segment, string> = {
  garden: "Search seeds, pots, manure…",
  farm: "Search sprayers, brushcutters, pesticides…",
};

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="flex flex-col leading-none text-charcoal shrink-0">
      <span className="font-serif text-[1.45rem] md:text-[1.6rem] font-semibold tracking-[-0.01em]">Farmyzest</span>
      <span className="cat-label !text-[0.62rem] text-stone mt-1">Nidhi Enterprises · Est. {COMPANY_ESTABLISHED}</span>
    </Link>
  );
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-seg-ink text-bone text-[10px] font-medium flex items-center justify-center">
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function Header1({
  categories = [],
  collections = [],
  navLinks = [],
  specialPreview = null,
  quickNav = { garden: [], farm: [] },
  contact = { phone: null, phoneHref: null, whatsapp: null },
}: {
  categories?: NavCategory[];
  collections?: NavCollection[];
  navLinks?: NavLinkItem[];
  specialPreview?: SpecialPreview | null;
  quickNav?: Record<Segment, QuickNavItem[]>;
  contact?: HeaderContact;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const { itemCount } = useCartStore();
  const wishCount = useWishlist((s) => s.count());
  const { data: session } = useSession();
  const { segment } = useSegment();

  // Admins land in the admin panel from the user icon; everyone else goes to
  // their customer account.
  const accountHref = session?.user?.role === "ADMIN" ? "/admin" : "/account";

  // Lock page scroll behind the mobile menu.
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const segmentLinks = quickNav[segment];
  // Only categories the admin chose to show in the department menu.
  const menuCategories = categories.filter((c) => c.showInMenu !== false);
  // Admin-curated collections flagged to appear directly in the nav bar.
  const headerCollections = collections.filter((c) => c.showInHeader);
  const cartCount = itemCount();

  const navItem = "text-[15px] text-charcoal hover:text-seg-ink transition-colors whitespace-nowrap";

  return (
    <>
      {/* Utility strip — scrolls away; the header below stays pinned. */}
      <div className="bg-moss text-bone/85">
        <div className="mx-auto max-w-[var(--w-content)] px-4 sm:px-6 lg:px-10 h-8 flex items-center justify-between gap-4">
          <p className="cat-label !text-[0.68rem] truncate">Trusted by growers since {COMPANY_ESTABLISHED}</p>
          <div className="hidden sm:flex items-center gap-5 text-[13px]">
            {contact.whatsapp && (
              <a
                href={`https://wa.me/${contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-bone"
              >
                <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> WhatsApp
              </a>
            )}
            {contact.phone && contact.phoneHref && (
              <a href={contact.phoneHref} className="inline-flex items-center gap-1.5 hover:text-bone">
                <Phone className="w-3.5 h-3.5" strokeWidth={1.75} /> {contact.phone}
              </a>
            )}
            <Link href="/contact" className="hover:text-bone">
              Help
            </Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-bone/95 backdrop-blur-sm border-b border-rule" onMouseLeave={() => setMegaOpen(false)}>
        {/* Main row */}
        <div className="mx-auto max-w-[var(--w-content)] px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3 md:gap-6 h-14 md:h-[72px]">
            <button
              className="md:hidden -ml-2 p-2.5 text-charcoal cursor-pointer"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <Logo />

            <div className="hidden md:block shrink-0">
              <SegmentSwitch />
            </div>

            {/* Search field (opens the live search overlay). */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hidden md:flex flex-1 min-w-0 max-w-xl items-center gap-3 h-11 px-4 border border-rule bg-parchment/60 text-left text-[15px] text-stone hover:border-stone/60 transition-colors cursor-pointer"
            >
              <Search className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
              <span className="truncate">{SEARCH_HINT[segment]}</span>
            </button>

            <div className="ml-auto flex items-center">
              {session?.user?.role === "RESELLER" && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 mr-2 cat-label !text-[0.65rem] border border-seg-ink text-seg-ink">
                  Reseller
                </span>
              )}
              <Link href="/wishlist" className="hidden md:flex p-2.5 relative text-charcoal hover:text-seg-ink" aria-label="Wishlist">
                <Heart className="w-5 h-5" strokeWidth={1.5} />
                <CountBadge n={wishCount} />
              </Link>
              <Link
                href={accountHref}
                className="hidden md:flex p-2.5 text-charcoal hover:text-seg-ink"
                aria-label={session?.user?.role === "ADMIN" ? "Admin panel" : "Account"}
              >
                <User className="w-5 h-5" strokeWidth={1.5} />
              </Link>
              <Link href="/cart" className="p-2.5 -mr-2 md:mr-0 relative text-charcoal hover:text-seg-ink" aria-label={`Cart, ${cartCount} items`}>
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                <CountBadge n={cartCount} />
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile: switch + search */}
        <div className="md:hidden flex items-center gap-2 px-4 pb-2.5">
          <SegmentSwitch />
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2 h-10 px-3 border border-rule bg-parchment/60 text-[15px] text-stone cursor-pointer"
          >
            <Search className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span className="truncate">Search</span>
          </button>
        </div>

        {/* Desktop category row */}
        <div className="hidden md:block border-t border-rule bg-seg-surface/70">
          <nav
            aria-label={`${segment === "farm" ? "Farm" : "Garden"} categories`}
            className="mx-auto max-w-[var(--w-content)] px-4 sm:px-6 lg:px-10 h-12 flex items-center gap-7 overflow-x-auto"
          >
            <button
              type="button"
              aria-expanded={megaOpen}
              onClick={() => setMegaOpen((v) => !v)}
              onMouseEnter={() => setMegaOpen(true)}
              className="inline-flex items-center gap-1 text-[15px] font-medium text-charcoal hover:text-seg-ink cursor-pointer whitespace-nowrap"
            >
              All departments
              <ChevronDown className={`w-4 h-4 transition-transform ${megaOpen ? "rotate-180" : ""}`} strokeWidth={1.5} />
            </button>
            <span className="h-5 w-px bg-rule shrink-0" aria-hidden="true" />
            {segmentLinks.map((c) => (
              <Link key={c.slug} href={`/shop?category=${c.slug}`} onMouseEnter={() => setMegaOpen(false)} className={navItem}>
                {c.name}
              </Link>
            ))}
            {headerCollections.map((c) => (
              <Link key={c.slug} href={`/collections/${c.slug}`} onMouseEnter={() => setMegaOpen(false)} className={navItem}>
                {c.name}
              </Link>
            ))}
            {navLinks.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                target={link.newTab ? "_blank" : undefined}
                rel={link.newTab ? "noopener noreferrer" : undefined}
                onMouseEnter={() => setMegaOpen(false)}
                className={navItem}
              >
                {link.label}
              </Link>
            ))}
            <span className="ml-auto hidden xl:block" />
            <Link href="/about" onMouseEnter={() => setMegaOpen(false)} className={`${navItem} text-stone hidden xl:inline`}>
              Our story
            </Link>
          </nav>
        </div>

        {/* Department mega-menu */}
        {megaOpen && (menuCategories.length > 0 || collections.length > 0) && (
          <div className="hidden md:block absolute top-full left-0 right-0 bg-bone border-b border-rule animate-fade-in">
            <div className="mx-auto max-w-[var(--w-content)] px-4 sm:px-6 lg:px-10 py-8 grid grid-cols-4 gap-8 max-h-[70vh] overflow-y-auto">
              <div className="col-span-3 grid grid-cols-3 gap-x-8 gap-y-7">
                {menuCategories.map((cat) => (
                  <div key={cat.slug}>
                    {cat.menuImageUrl && (
                      <Link href={`/shop?category=${cat.slug}`} onClick={() => setMegaOpen(false)} className="block mb-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cat.menuImageUrl} alt="" className="w-full h-24 object-cover" loading="lazy" />
                      </Link>
                    )}
                    <Link
                      href={`/shop?category=${cat.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className={`inline-flex items-center gap-1.5 font-serif text-lg leading-snug mb-2 ${
                        cat.menuHighlight ? "text-seg-ink" : "text-charcoal hover:text-seg-ink"
                      }`}
                    >
                      {cat.menuHighlight && <Star className="w-3.5 h-3.5 fill-current shrink-0" />}
                      {cat.name}
                    </Link>
                    {cat.children && cat.children.length > 0 && (
                      <ul className="space-y-1.5">
                        {cat.children.map((child) => (
                          <li key={child.slug}>
                            <Link
                              href={`/shop?category=${child.slug}`}
                              onClick={() => setMegaOpen(false)}
                              className="text-[15px] text-stone hover:text-charcoal transition-colors"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-l border-rule pl-8">
                <p className="cat-label text-stone mb-3">Collections</p>
                <ul className="space-y-1.5">
                  <li>
                    <Link href="/shop" onClick={() => setMegaOpen(false)} className="text-[15px] text-charcoal hover:text-seg-ink">
                      Shop everything
                    </Link>
                  </li>
                  {collections.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/collections/${c.slug}`}
                        onClick={() => setMegaOpen(false)}
                        className="text-[15px] text-stone hover:text-charcoal transition-colors"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Special Prices preview tile (admin-configured category). */}
                {specialPreview && (
                  <Link
                    href={`/shop?category=${specialPreview.slug}`}
                    onClick={() => setMegaOpen(false)}
                    className="group/sp mt-6 block border border-rule bg-parchment"
                  >
                    <div className="relative aspect-[4/3] bg-sand overflow-hidden">
                      {specialPreview.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={specialPreview.imageUrl}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/sp:scale-[1.03]"
                          loading="lazy"
                        />
                      )}
                      <span className="absolute top-2 left-2 bg-seg-ink text-bone cat-label !text-[0.68rem] px-2 py-1">
                        Flat {specialPreview.discountPct}% off
                      </span>
                    </div>
                    <span className="block px-3 py-2.5 text-[15px] text-charcoal">{specialPreview.name}</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <SearchOverlay open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col bg-bone animate-fade-in" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex items-center justify-between px-4 h-14 border-b border-rule">
            <Logo onClick={() => setIsMobileMenuOpen(false)} />
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2.5 -mr-2 cursor-pointer" aria-label="Close menu">
              <X className="w-5 h-5 text-charcoal" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-4 border-b border-rule">
              <SegmentSwitch full />
            </div>

            {segmentLinks.length > 0 && (
              <nav className="px-4 py-2 border-b border-rule" aria-label="Quick categories">
                {segmentLinks.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/shop?category=${c.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center min-h-12 font-serif text-xl text-charcoal"
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}

            <nav className="px-4 py-4 border-b border-rule" aria-label="All departments">
              <p className="cat-label text-stone mb-1">All departments</p>
              {menuCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/shop?category=${cat.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center min-h-11 text-base text-charcoal"
                >
                  {cat.name}
                </Link>
              ))}
              <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center min-h-11 text-base text-seg-ink">
                Shop everything
              </Link>
            </nav>

            <nav className="px-4 py-4" aria-label="More">
              {[...headerCollections.map((c) => ({ href: `/collections/${c.slug}`, label: c.name, newTab: false })), ...navLinks, { href: "/about", label: "Our story" }, { href: "/contact", label: "Contact us" }].map((l) => (
                <Link
                  key={`${l.label}-${l.href}`}
                  href={l.href}
                  target={l.newTab ? "_blank" : undefined}
                  rel={l.newTab ? "noopener noreferrer" : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center min-h-11 text-base text-charcoal"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-3 border-t border-rule text-sm text-charcoal">
            <Link href={accountHref} onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center gap-1 py-3">
              <User className="w-5 h-5" strokeWidth={1.5} />
              {session?.user?.role === "ADMIN" ? "Admin" : "Account"}
            </Link>
            <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center gap-1 py-3 border-x border-rule">
              <Heart className="w-5 h-5" strokeWidth={1.5} />
              Wishlist
            </Link>
            {contact.whatsapp ? (
              <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-3">
                <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
                WhatsApp
              </a>
            ) : (
              <Link href="/cart" onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center gap-1 py-3">
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                Cart
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

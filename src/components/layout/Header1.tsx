"use client";

import Link from "next/link";
import { Search, ShoppingBag, User, Menu, X, Heart, Star } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useWishlist } from "@/lib/wishlist";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { SearchOverlay } from "./SearchOverlay";
import { AnnouncementBar } from "./AnnouncementBar";

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

export function Header1({
  categories = [],
  collections = [],
  navLinks = [],
  specialPreview = null,
}: {
  categories?: NavCategory[];
  collections?: NavCollection[];
  navLinks?: NavLinkItem[];
  specialPreview?: SpecialPreview | null;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { itemCount } = useCartStore();
  const wishCount = useWishlist((s) => s.count());
  const pathname = usePathname();
  const { data: session } = useSession();

  // Admins land in the admin panel from the user icon; everyone else goes to
  // their customer account.
  const accountHref = session?.user?.role === "ADMIN" ? "/admin" : "/account";

  const hasHero = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mega menu forces the light (solid) header so the panel reads on white.
  const isLight = !hasHero || scrolled || megaOpen;
  const textColor = isLight ? "text-grey-800" : "text-white";
  const iconColor = isLight ? "text-grey-700" : "text-white";
  const hoverBg = isLight ? "hover:bg-grey-100" : "hover:bg-white/10";

  // Admin-curated navbar links (from /admin/navigation); fall back to defaults.
  const simpleLinks: NavLinkItem[] = navLinks.length
    ? navLinks
    : [
        { href: "/shop?category=plants", label: "Plants" },
        { href: "/shop?category=seeds", label: "Seeds" },
        { href: "/about", label: "About" },
      ];

  // Always-on header entries (new categories + Contact), shown in addition to
  // the admin-curated nav. Category links land on the filtered shop.
  const fixedLinks: NavLinkItem[] = [
    { href: "/shop?category=fertilizers-manures", label: "Plant Care" },
    { href: "/shop?category=garden-machinery", label: "Machinery" },
    { href: "/shop?category=garden-tools", label: "Tools" },
    { href: "/contact", label: "Contact Us" },
  ];

  // Only categories the admin chose to show in the Shop mega-menu.
  const menuCategories = categories.filter((c) => c.showInMenu !== false);

  // Admin-curated collections flagged to appear directly in the nav bar.
  const headerCollections = collections.filter((c) => c.showInHeader);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isLight
            ? "bg-white/95 backdrop-blur-md border-b border-grey-200"
            : "bg-transparent"
        }`}
        onMouseLeave={() => setMegaOpen(false)}
      >
        {/* Running offers bar — full width, sits at the top of the header on
            every page (a solid strip below the transparent nav would slice the
            homepage hero). */}
        <AnnouncementBar />

        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
          <div className="flex items-center justify-between h-[72px] md:h-20">
            {/* Mobile menu button */}
            <button
              className={`md:hidden p-2 -ml-2 ${iconColor} transition-colors cursor-pointer`}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* Logo */}
            <Link
              href="/"
              className={`flex flex-col leading-none ${textColor} transition-colors duration-500`}
            >
              <span className="text-lg md:text-xl font-serif tracking-[0.08em] uppercase">
                Farmyzest
              </span>
              <span className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase opacity-70 mt-1">
                by Nidhi Enterprises · Est. 1962
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-10">
              {/* Shop — opens mega menu on hover */}
              <div onMouseEnter={() => setMegaOpen(true)} className="relative">
                <Link
                  href="/shop"
                  onClick={() => setMegaOpen(false)}
                  className={`text-xs font-sans font-medium uppercase tracking-[0.15em] ${textColor} transition-colors duration-500 relative group inline-flex`}
                >
                  Shop
                  <span
                    className={`absolute -bottom-0.5 left-0 h-px transition-all duration-300 ${
                      megaOpen ? "w-full" : "w-0 group-hover:w-full"
                    } ${isLight ? "bg-grey-800" : "bg-white"}`}
                  />
                </Link>
              </div>

              {simpleLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  target={link.newTab ? "_blank" : undefined}
                  rel={link.newTab ? "noopener noreferrer" : undefined}
                  onMouseEnter={() => setMegaOpen(false)}
                  className={`text-xs font-sans font-medium uppercase tracking-[0.15em] ${textColor} transition-colors duration-500 relative group`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 w-0 h-px transition-all duration-300 group-hover:w-full ${
                      isLight ? "bg-grey-800" : "bg-white"
                    }`}
                  />
                </Link>
              ))}

              {/* Collections flagged showInHeader get their own nav link. */}
              {headerCollections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  onMouseEnter={() => setMegaOpen(false)}
                  className={`text-xs font-sans font-medium uppercase tracking-[0.15em] ${textColor} transition-colors duration-500 relative group`}
                >
                  {c.name}
                  <span
                    className={`absolute -bottom-0.5 left-0 w-0 h-px transition-all duration-300 group-hover:w-full ${
                      isLight ? "bg-grey-800" : "bg-white"
                    }`}
                  />
                </Link>
              ))}

              {/* Always-on entries: new categories + Contact. */}
              {fixedLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  onMouseEnter={() => setMegaOpen(false)}
                  className={`text-xs font-sans font-medium uppercase tracking-[0.15em] ${textColor} transition-colors duration-500 relative group`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 w-0 h-px transition-all duration-300 group-hover:w-full ${
                      isLight ? "bg-grey-800" : "bg-white"
                    }`}
                  />
                </Link>
              ))}
            </nav>

            {/* Right icons */}
            <div className="flex items-center gap-1">
              {session?.user?.role === "RESELLER" && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 mr-1 text-[10px] font-semibold uppercase tracking-wider bg-accent text-white rounded-full">
                  Reseller
                </span>
              )}
              <button
                onClick={() => setIsSearchOpen(true)}
                className={`p-2.5 ${hoverBg} transition-colors duration-300 cursor-pointer`}
                aria-label="Search"
              >
                <Search className={`w-[18px] h-[18px] ${iconColor}`} strokeWidth={1.5} />
              </button>

              <Link
                href="/wishlist"
                className={`hidden md:flex p-2.5 ${hoverBg} transition-colors duration-300 relative`}
                aria-label="Wishlist"
              >
                <Heart className={`w-[18px] h-[18px] ${iconColor}`} strokeWidth={1.5} />
                {wishCount > 0 && (
                  <span className="absolute top-1 right-1 w-[16px] h-[16px] bg-grey-900 text-white text-[9px] font-medium flex items-center justify-center">
                    {wishCount > 9 ? "9+" : wishCount}
                  </span>
                )}
              </Link>

              <Link
                href={accountHref}
                className={`hidden md:flex p-2.5 ${hoverBg} transition-colors duration-300`}
                aria-label={session?.user?.role === "ADMIN" ? "Admin panel" : "Account"}
              >
                <User className={`w-[18px] h-[18px] ${iconColor}`} strokeWidth={1.5} />
              </Link>

              <Link
                href="/cart"
                className={`p-2.5 ${hoverBg} transition-colors duration-300 relative`}
                aria-label="Bag"
              >
                <ShoppingBag className={`w-[18px] h-[18px] ${iconColor}`} strokeWidth={1.5} />
                {itemCount() > 0 && (
                  <span className="absolute top-1 right-1 w-[16px] h-[16px] bg-grey-900 text-white text-[9px] font-medium flex items-center justify-center">
                    {itemCount() > 9 ? "9+" : itemCount()}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Mega menu panel */}
        {megaOpen && (menuCategories.length > 0 || collections.length > 0) && (
          <div
            className="hidden md:block absolute top-full left-0 right-0 bg-white border-b border-grey-200 shadow-lg animate-fade-in"
            onMouseLeave={() => setMegaOpen(false)}
          >
            <div className="scrollbar-thin w-full px-6 md:px-12 lg:px-20 xl:px-24 py-6 grid grid-cols-4 gap-6 max-h-[75vh] overflow-y-auto">
              {/* Categories */}
              <div className="col-span-3 grid grid-cols-3 gap-x-6 gap-y-4">
                {menuCategories.map((cat) => (
                  <div key={cat.slug}>
                    {cat.menuImageUrl && (
                      <Link href={`/shop?category=${cat.slug}`} onClick={() => setMegaOpen(false)} className="block mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cat.menuImageUrl}
                          alt={cat.name}
                          className="w-full h-24 object-cover rounded"
                        />
                      </Link>
                    )}
                    <Link
                      href={`/shop?category=${cat.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className={`text-xs uppercase tracking-[0.15em] mb-3 transition-colors ${
                        cat.menuHighlight
                          ? "inline-flex items-center gap-1.5 font-bold text-amber-900 bg-amber-50 ring-1 ring-amber-300 rounded-full px-2.5 py-1 hover:bg-amber-100"
                          : "block font-medium text-grey-900 hover:text-grey-500"
                      }`}
                    >
                      {cat.menuHighlight && (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      )}
                      {cat.name}
                    </Link>
                    {cat.children && cat.children.length > 0 && (
                      <ul className="space-y-2">
                        {cat.children.map((child) => (
                          <li key={child.slug}>
                            <Link
                              href={`/shop?category=${child.slug}`}
                              onClick={() => setMegaOpen(false)}
                              className="text-sm text-grey-500 hover:text-grey-900 transition-colors"
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

              {/* Collections column */}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-grey-900 mb-3">
                  Collections
                </p>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/shop"
                      onClick={() => setMegaOpen(false)}
                      className="text-sm text-grey-500 hover:text-grey-900 transition-colors"
                    >
                      Shop All
                    </Link>
                  </li>
                  {collections.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/collections/${c.slug}`}
                        onClick={() => setMegaOpen(false)}
                        className="text-sm text-grey-500 hover:text-grey-900 transition-colors"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Special Prices preview tile — pinned to the bottom-right of
                    the mega menu. Photo, banner and label are three independent
                    links that all land on the Special Prices category. */}
                {specialPreview && (
                  <div className="relative mt-6 rounded-lg overflow-hidden border border-grey-200 bg-grey-50">
                    <Link
                      href={`/shop?category=${specialPreview.slug}`}
                      onClick={() => setMegaOpen(false)}
                      aria-label={specialPreview.name}
                      className="group/sp block relative aspect-[4/3] bg-grey-200"
                    >
                      {specialPreview.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={specialPreview.imageUrl}
                          alt={specialPreview.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/sp:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-grey-200" />
                      )}
                    </Link>
                    {/* Banner — independent clickable link overlaid on the photo. */}
                    <Link
                      href={`/shop?category=${specialPreview.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow hover:bg-red-700 transition-colors"
                    >
                      Flat {specialPreview.discountPct}% Off
                    </Link>
                    {/* Label — independent clickable link below the photo. */}
                    <Link
                      href={`/shop?category=${specialPreview.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="block px-3 py-2.5 text-sm font-medium text-grey-900 hover:text-grey-600 transition-colors"
                    >
                      {specialPreview.name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Full-screen search overlay */}
      <SearchOverlay open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Full-screen mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-white md:hidden flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-6 h-[72px] border-b border-grey-200">
            <span className="flex flex-col leading-none text-grey-900">
              <span className="text-lg font-serif tracking-[0.08em] uppercase">Farmyzest</span>
              <span className="text-[9px] tracking-[0.2em] uppercase opacity-70 mt-1">by Nidhi Enterprises · Est. 1962</span>
            </span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-grey-700" strokeWidth={1.5} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-6">
            <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-serif text-grey-900">
              Shop All
            </Link>
            {menuCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/shop?category=${cat.slug}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-lg font-sans text-grey-700 hover:text-grey-900"
              >
                {cat.name}
              </Link>
            ))}
            <div className="border-t border-grey-200 pt-6 flex flex-col gap-4">
              {simpleLinks.map((l) => (
                <Link
                  key={`${l.label}-${l.href}`}
                  href={l.href}
                  target={l.newTab ? "_blank" : undefined}
                  rel={l.newTab ? "noopener noreferrer" : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-sans text-grey-700 hover:text-grey-900"
                >
                  {l.label}
                </Link>
              ))}
              {headerCollections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-sans text-grey-700 hover:text-grey-900"
                >
                  {c.name}
                </Link>
              ))}
              {fixedLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-sans text-grey-700 hover:text-grey-900"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="px-8 pb-10 flex items-center gap-8 border-t border-grey-200 pt-6">
            <Link href={accountHref} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-sm text-grey-600">
              <User className="w-4 h-4" strokeWidth={1.5} />
              {session?.user?.role === "ADMIN" ? "Admin" : "Account"}
            </Link>
            <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-sm text-grey-600">
              <Heart className="w-4 h-4" strokeWidth={1.5} />
              Wishlist
            </Link>
            <Link href="/cart" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-sm text-grey-600">
              <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
              Bag
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

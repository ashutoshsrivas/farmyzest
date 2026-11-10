"use client";

import Link from "next/link";
import { Search, ShoppingBag, User, Menu, X, Heart } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useState } from "react";

export function Header3() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { itemCount } = useCartStore();

  const navLinks = [
    { href: "/shop", label: "Shop" },
    { href: "/shop?collection=summer", label: "Summer" },
    { href: "/shop?collection=winter", label: "Winter" },
    { href: "/about", label: "About" },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="w-full px-6 md:px-12 lg:px-16 py-6">
          <div className="flex items-center justify-between">
            <button
              className="md:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
            </button>

            <Link
              href="/"
              className="text-2xl md:text-3xl font-serif tracking-wide text-white"
            >
              Farmyzest
            </Link>

            <nav className="hidden md:flex items-center gap-10">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors uppercase tracking-wider"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Search className="w-5 h-5 text-white" />
              </button>
              <Link href="/cart" className="p-2 hover:bg-white/10 rounded-full transition-colors relative">
                <ShoppingBag className="w-5 h-5 text-white" />
                {itemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {itemCount() > 9 ? "9+" : itemCount()}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {isSearchOpen && (
          <div className="absolute top-full left-0 right-0 bg-transparent p-4">
            <div className="max-w-xl mx-auto">
              <input
                type="search"
                placeholder="Search..."
                className="w-full px-6 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-full text-white placeholder:text-white/50 focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-nate-grey-800/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col h-full justify-center items-center">
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6">
              <X className="w-8 h-8 text-white" />
            </button>
            <nav className="flex flex-col items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-serif text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
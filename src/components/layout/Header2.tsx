"use client";

import Link from "next/link";
import { Search, ShoppingBag, User, Menu, X, Heart } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useState } from "react";

export function Header2() {
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-nate-grey-800">
        <div className="w-full px-6 md:px-12 lg:px-16">
          <div className="flex items-center justify-between h-16 md:h-20">
            <button
              className="md:hidden p-2 -ml-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-white" />
              )}
            </button>

            <Link
              href="/"
              className="text-xl md:text-2xl font-serif tracking-wide text-white"
            >
              Farmyzest
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-white/70 hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
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
          <div className="absolute top-full left-0 right-0 bg-nate-grey-800 border-t border-nate-grey-700 p-4">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nate-grey-400" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="w-full pl-12 pr-4 py-3 bg-nate-grey-700 border-none rounded-lg text-white placeholder:text-nate-grey-400 focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-nate-grey-800 md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-nate-grey-700">
              <span className="text-xl font-serif text-white">Farmyzest</span>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            <nav className="flex-1 p-6 space-y-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-lg font-medium text-white"
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
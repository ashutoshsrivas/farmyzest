"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, ShoppingBag, User, Menu, X, Heart, LogOut } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { itemCount } = useCartStore();
  const { data: session } = useSession();
  const router = useRouter();

  const navLinks = [
    { href: "/shop", label: "Shop" },
    { href: "/shop?collection=summer", label: "Summer" },
    { href: "/shop?collection=winter", label: "Winter" },
    { href: "/about", label: "About" },
  ];

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white shadow-sm`}>
        <div className="w-full px-6 md:px-12 lg:px-16">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 -ml-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-nate-grey-700" />
              ) : (
                <Menu className="w-5 h-5 text-nate-grey-700" />
              )}
            </button>

            {/* Logo */}
            <Link
              href="/"
              className="text-xl md:text-2xl font-serif tracking-wide text-nate-grey-800"
            >
              Farmyzest
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-nate-grey-600 hover:text-nate-grey-800 transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-px bg-accent transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </nav>

            {/* Right icons */}
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 hover:bg-nate-grey-100 rounded-full transition-colors"
              >
                <Search className="w-5 h-5 text-nate-grey-700" />
              </button>

              <Link
                href="/wishlist"
                className="hidden md:block p-2 hover:bg-nate-grey-100 rounded-full transition-colors"
              >
                <Heart className="w-5 h-5 text-nate-grey-700" />
              </Link>

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="hidden md:flex items-center gap-2 p-2 hover:bg-nate-grey-100 rounded-full transition-colors"
                >
                  <User className="w-5 h-5 text-nate-grey-700" />
                  {session?.user?.name && (
                    <span className="text-sm text-nate-grey-700 font-medium max-w-[100px] truncate">
                      {session.user.name.split(" ")[0]}
                    </span>
                  )}
                </button>

                {/* Mobile user icon (no dropdown) */}
                <Link
                  href="/account"
                  className="md:hidden p-2 hover:bg-nate-grey-100 rounded-full transition-colors"
                >
                  <User className="w-5 h-5 text-nate-grey-700" />
                </Link>

                {/* Dropdown menu */}
                {isUserMenuOpen && session?.user && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-nate-grey-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-nate-grey-100">
                      <p className="text-sm font-medium text-nate-grey-800 truncate">
                        {session.user.name}
                      </p>
                      <p className="text-xs text-nate-grey-500 truncate">
                        {session.user.email}
                      </p>
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-nate-grey-700 hover:bg-nate-grey-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      My Account
                    </Link>
                    <Link
                      href="/account/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-nate-grey-700 hover:bg-nate-grey-50 transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      My Orders
                    </Link>
                    <hr className="my-1 border-nate-grey-100" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-nate-grey-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}

                {/* Login link when not authenticated */}
                {!session?.user && (
                  <Link
                    href="/auth/login"
                    className="hidden md:flex p-2 hover:bg-nate-grey-100 rounded-full transition-colors"
                  >
                    <User className="w-5 h-5 text-nate-grey-700" />
                  </Link>
                )}
              </div>

              <Link
                href="/cart"
                className="p-2 hover:bg-nate-grey-100 rounded-full transition-colors relative"
              >
                <ShoppingBag className="w-5 h-5 text-nate-grey-700" />
                {itemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-nate-grey-800 text-xs font-medium rounded-full flex items-center justify-center">
                    {itemCount() > 9 ? "9+" : itemCount()}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Search overlay */}
        {isSearchOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-nate-grey-200 p-4 animate-fade-in">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nate-grey-400" />
                <input
                  type="search"
                  placeholder="Search for products..."
                  className="w-full pl-12 pr-4 py-3 bg-nate-grey-100 border-none rounded-lg focus:ring-2 focus:ring-accent text-nate-grey-700 placeholder:text-nate-grey-400"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Click outside to close user menu */}
      {isUserMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-nate-grey-200">
              <span className="text-xl font-serif text-nate-grey-800">
                Farmyzest
              </span>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-6 h-6 text-nate-grey-700" />
              </button>
            </div>
            <nav className="flex-1 p-6 space-y-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-lg font-medium text-nate-grey-700 hover:text-nate-grey-800"
                >
                  {link.label}
                </Link>
              ))}
              <hr className="border-nate-grey-200" />
              {session?.user ? (
                <>
                  <div className="text-sm text-nate-grey-500">
                    Signed in as{" "}
                    <span className="font-medium text-nate-grey-700">
                      {session.user.name}
                    </span>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-lg font-medium text-nate-grey-700 hover:text-nate-grey-800"
                  >
                    My Account
                  </Link>
                  <Link
                    href="/account/orders"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-lg font-medium text-nate-grey-700 hover:text-nate-grey-800"
                  >
                    My Orders
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="block text-lg font-medium text-nate-grey-500 hover:text-red-600"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-lg font-medium text-nate-grey-700 hover:text-nate-grey-800"
                >
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
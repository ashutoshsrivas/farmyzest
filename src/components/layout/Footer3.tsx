"use client";

import Link from "next/link";

export function Footer3() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-nate-grey-800 text-white py-20">
      <div className="w-full px-6 md:px-12 lg:px-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Farmyzest</h2>
          <p className="text-white/60">Fashion that speaks without words</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 mb-16">
          <Link href="/shop" className="text-white/70 hover:text-accent transition-colors uppercase tracking-wider text-sm">Shop</Link>
          <Link href="/about" className="text-white/70 hover:text-accent transition-colors uppercase tracking-wider text-sm">About</Link>
          <Link href="/contact" className="text-white/70 hover:text-accent transition-colors uppercase tracking-wider text-sm">Contact</Link>
          <Link href="/stores" className="text-white/70 hover:text-accent transition-colors uppercase tracking-wider text-sm">Stores</Link>
        </div>

        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-white/40 text-sm">© {currentYear} Farmyzest. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
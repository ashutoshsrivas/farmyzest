"use client";

import Link from "next/link";

export function Footer2() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-nate-grey-800 text-white">
      <div className="w-full px-6 md:px-12 lg:px-16 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <Link href="/" className="text-2xl font-serif">
              Farmyzest
            </Link>
            <p className="mt-4 text-nate-grey-400 text-sm leading-relaxed">
              Curated fashion for the modern individual. Quality apparel and accessories.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-6 text-accent">Quick Links</h4>
            <ul className="space-y-4">
              <li><Link href="/shop" className="text-white/70 hover:text-accent transition-colors">Shop</Link></li>
              <li><Link href="/about" className="text-white/70 hover:text-accent transition-colors">About</Link></li>
              <li><Link href="/contact" className="text-white/70 hover:text-accent transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-6 text-accent">Newsletter</h4>
            <p className="text-white/60 text-sm mb-4">Subscribe for exclusive offers.</p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Email"
                className="flex-1 px-4 py-2 bg-nate-grey-700 border border-nate-grey-600 rounded-lg text-white placeholder:text-nate-grey-400 text-sm focus:outline-none focus:border-accent"
              />
              <button className="px-6 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-nate-grey-700 text-center">
          <p className="text-nate-grey-500 text-sm">© {currentYear} Farmyzest. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
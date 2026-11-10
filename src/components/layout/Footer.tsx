"use client";

import Link from "next/link";
import { Globe2Icon, MailIcon } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    shop: [
      { label: "New Arrivals", href: "/shop?sort=newest" },
      { label: "Summer Collection", href: "/shop?collection=summer" },
      { label: "Winter Collection", href: "/shop?collection=winter" },
      { label: "Accessories", href: "/shop?category=accessories" },
    ],
    help: [
      { label: "Contact Us", href: "/contact" },
      { label: "Shipping Info", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "Size Guide", href: "/size-guide" },
    ],
    company: [
      { label: "About Us", href: "/about" },
      { label: "Store Locator", href: "/stores" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  };

  return (
    <footer className="bg-nate-grey-800 text-white">
      {/* Newsletter */}
      <div className="border-b border-nate-grey-700">
        <div className="w-full px-6 md:px-12 lg:px-16 py-12">
          <div className="max-w-xl">
            <h3 className="text-xl font-serif mb-2">Stay in Style</h3>
            <p className="text-nate-grey-400 text-sm mb-4">
              Subscribe for exclusive offers and latest collections.
            </p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 px-4 py-2 bg-nate-grey-700 border border-nate-grey-600 rounded-lg text-white placeholder:text-nate-grey-500 focus:outline-none focus:border-accent text-sm"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-accent text-nate-grey-800 font-medium text-sm rounded-lg hover:bg-nate-grey-300 transition-colors"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="w-full px-6 md:px-12 lg:px-16 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-serif">
              Farmyzest
            </Link>
            <p className="mt-4 text-nate-grey-400 text-sm leading-relaxed">
              Curated fashion for the modern individual. Quality apparel and accessories that define your unique style.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-medium mb-4 text-sm">Shop</h4>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-nate-grey-400 text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-medium mb-4 text-sm">Help</h4>
            <ul className="space-y-3">
              {footerLinks.help.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-nate-grey-400 text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-medium mb-4 text-sm">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-nate-grey-400 text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social + Copyright */}
        <div className="mt-12 pt-8 border-t border-nate-grey-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="#" className="text-nate-grey-400 hover:text-white transition-colors">
              <Globe2Icon className="w-5 h-5" />
            </a>
            <a href="#" className="text-nate-grey-400 hover:text-white transition-colors">
              <Globe2Icon className="w-5 h-5" />
            </a>
            <a href="#" className="text-nate-grey-400 hover:text-white transition-colors">
              <MailIcon className="w-5 h-5" />
            </a>
          </div>
          <p className="text-nate-grey-500 text-sm">
            © {currentYear} Farmyzest. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
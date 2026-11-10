"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tags,
  Users,
  Settings,
  BarChart3,
  Truck,
  CreditCard,
  Monitor,
  Receipt,
  Boxes,
  Layers,
  Mail,
  Barcode,
  ReceiptText,
  RefreshCw,
  UserRound,
  LayoutTemplate,
  Navigation as NavIcon,
  Ticket,
  Undo2,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SignOutButton from "@/components/auth/SignOutButton";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/products", icon: Package, label: "Products" },
  // Inventory was sharing the Tags icon with Categories — Boxes reads as stock
  // more clearly. Collections gets Layers (groupings of products).
  { href: "/admin/inventory", icon: Boxes, label: "Inventory" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/admin/customers", icon: UserRound, label: "Customers" },
  { href: "/admin/resellers", icon: Store, label: "Resellers" },
  { href: "/admin/exchanges/new", icon: RefreshCw, label: "Exchange" },
  { href: "/admin/goods-returns", icon: Undo2, label: "Goods Return" },
  { href: "/admin/collections", icon: Layers, label: "Collections" },
  { href: "/admin/landing", icon: LayoutTemplate, label: "Landing Page" },
  { href: "/admin/navigation", icon: NavIcon, label: "Navigation" },
  { href: "/admin/categories", icon: Tags, label: "Categories" },
  { href: "/admin/salesmen", icon: Users, label: "Salesmen" },
  { href: "/admin/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/admin/purchases", icon: ReceiptText, label: "Purchases" },
  { href: "/admin/loyalty", icon: CreditCard, label: "Loyalty" },
  { href: "/admin/coupons", icon: Ticket, label: "Coupons" },
  { href: "/admin/reports", icon: BarChart3, label: "Reports" },
  { href: "/admin/taxes", icon: Receipt, label: "Taxes" },
  { href: "/admin/barcodes", icon: Barcode, label: "Barcodes" },
  { href: "/admin/contact", icon: Mail, label: "Messages" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/admin") return "Dashboard";
  const segments = pathname.replace("/admin/", "").split("/");
  const top = segments[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (segments.length > 1) {
    const sub = segments[1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${top} — ${sub}`;
  }
  return top;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    // h-screen + overflow-hidden pins the whole shell to the viewport so the
    // sidebar never scrolls with the page. The nav list and the main content
    // each get their own independent scroll region below.
    <div className="flex h-screen overflow-hidden bg-nate-grey-100">
      {/* Sidebar — full viewport height, fixed; only its <nav> scrolls. */}
      <aside className="w-64 bg-nate-grey-800 text-white flex-shrink-0 flex flex-col h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-nate-grey-700">
          <Link href="/admin" className="text-xl font-serif">
            Farmyzest
          </Link>
          <p className="text-xs text-nate-grey-400 mt-1">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-white/15 text-white font-semibold"
                    : "text-nate-grey-400 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-nate-grey-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-nate-grey-400">Admin</div>
            <SignOutButton variant="admin" />
          </div>
          <Link
            href="/"
            className="block mt-2 text-xs text-nate-grey-500 hover:text-white transition-colors"
          >
            ← View Store
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-14 bg-white border-b border-nate-grey-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="text-sm font-medium text-nate-grey-700">{pageTitle}</div>
          <a
            href="/pos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Monitor className="w-4 h-4" />
            Open POS
          </a>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

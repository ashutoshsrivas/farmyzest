"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, PackageSearch, LogOut } from "lucide-react";

export function StoreBoardNav() {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { href: "/store-board", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { href: "/store-board/products", icon: PackageSearch, label: "Stock", exact: false },
  ];

  async function logout() {
    try {
      await fetch("/api/store-board/login", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    router.replace("/store-board/login");
    router.refresh();
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-nate-grey-200 max-w-md mx-auto">
      <div className="flex items-stretch">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? "text-nate-grey-900" : "text-nate-grey-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              {t.label}
            </Link>
          );
        })}
        <button onClick={logout} className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-nate-grey-400 hover:text-red-600">
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </nav>
  );
}

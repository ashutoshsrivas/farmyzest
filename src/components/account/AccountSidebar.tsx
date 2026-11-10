"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, MapPin, User, Wallet } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

// Shared sidebar for every route under (store)/account/.
// Rendered from the account layout, so it persists across navigation between
// /account, /account/orders, /account/addresses, /account/profile.

interface AccountSidebarProps {
  userName: string;
  userEmail: string;
}

const NAV_ITEMS = [
  { href: "/account", label: "Overview", icon: User, exact: true },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/wallet", label: "Store Credit", icon: Wallet },
  { href: "/account/addresses", label: "Saved Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile", icon: User },
];

export function AccountSidebar({ userName, userEmail }: AccountSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-nate-grey-100">
        <div className="w-10 h-10 rounded-full bg-nate-grey-800 text-white flex items-center justify-center text-sm font-medium">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-nate-grey-800 text-sm truncate">{userName}</p>
          <p className="text-xs text-nate-grey-500 truncate">{userEmail}</p>
        </div>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-nate-grey-100 text-nate-grey-800 font-medium"
                  : "text-nate-grey-600 hover:bg-nate-grey-100 hover:text-nate-grey-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
        <hr className="my-3 border-nate-grey-100" />
        <SignOutButton />
      </nav>
    </div>
  );
}

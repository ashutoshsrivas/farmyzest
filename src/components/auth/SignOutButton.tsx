"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

interface SignOutButtonProps {
  variant?: "sidebar" | "admin";
}

export default function SignOutButton({ variant = "sidebar" }: SignOutButtonProps) {
  const handleSignOut = () => signOut({ callbackUrl: "/auth/login" });

  if (variant === "admin") {
    return (
      <button
        onClick={handleSignOut}
        className="text-xs text-nate-grey-500 hover:text-white transition-colors"
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-nate-grey-500 hover:bg-red-50 hover:text-red-600 text-sm transition-colors text-left"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </button>
  );
}

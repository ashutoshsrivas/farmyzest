import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Package, MapPin, Star } from "lucide-react";

export const metadata: Metadata = { title: "My Account — Farmyzest" };

// The account layout (../layout.tsx) provides the sidebar, page background,
// and max-width container. This page renders only the main-content column.

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, loyaltyPoints: true, createdAt: true },
  });

  if (!user) redirect("/auth/login");

  const recentOrderCount = await db.order.count({
    where: { userId: session.user.id },
  });

  return (
    <>
      <div className="mb-2">
        <h1 className="text-3xl font-serif text-nate-grey-800">My Account</h1>
        <p className="text-nate-grey-500 mt-1 text-sm">
          Welcome back, {user.name.split(" ")[0]}
        </p>
      </div>

      {/* Loyalty card */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-nate-grey-500 uppercase tracking-wide font-medium mb-1">
              Loyalty Points
            </p>
            <p className="text-3xl font-serif text-nate-grey-800">
              {Math.round(user.loyaltyPoints)}
            </p>
            <p className="text-xs text-nate-grey-400 mt-1">
              {user.loyaltyPoints >= 100
                ? `Worth up to ₹${(user.loyaltyPoints * 0.25).toFixed(0)}`
                : "Earn more with every order"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-400" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide font-medium mb-1">
            Total Orders
          </p>
          <p className="text-2xl font-serif text-nate-grey-800">{recentOrderCount}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide font-medium mb-1">
            Account Since
          </p>
          <p className="text-sm font-medium text-nate-grey-700 mt-1">
            {user.createdAt
              ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-serif text-nate-grey-800 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/account/orders"
            className="flex items-center gap-3 p-4 border border-nate-grey-200 rounded-xl hover:border-accent hover:shadow-sm transition-all"
          >
            <Package className="w-5 h-5 text-nate-grey-600" />
            <div>
              <p className="text-sm font-medium text-nate-grey-800">My Orders</p>
              <p className="text-xs text-nate-grey-400">
                Track &amp; manage your orders
              </p>
            </div>
          </Link>
          <Link
            href="/account/addresses"
            className="flex items-center gap-3 p-4 border border-nate-grey-200 rounded-xl hover:border-accent hover:shadow-sm transition-all"
          >
            <MapPin className="w-5 h-5 text-nate-grey-600" />
            <div>
              <p className="text-sm font-medium text-nate-grey-800">Saved Addresses</p>
              <p className="text-xs text-nate-grey-400">Manage delivery addresses</p>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminShell } from "./_components/AdminShell";

// Browser-tab title for the whole admin section.
export const metadata: Metadata = { title: "Admin — Farmyzest" };

// Server-side gate for the ENTIRE admin section. A layout runs on every nested
// /admin/* route, so this is the single chokepoint: only ADMIN users get in.
// (Pages previously only checked for *any* session, which let every logged-in
// customer reach the admin panel.)
//
// The role is re-checked against the DB (not just the JWT) so granting/revoking
// admin access takes effect on the next navigation, without waiting for the
// token to refresh.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?from=/admin");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true },
  });
  if (!me || !me.isActive || me.role !== "ADMIN") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}

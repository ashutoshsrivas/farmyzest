import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Browser-tab title for the whole POS section.
export const metadata: Metadata = { title: "POS — Farmyzest" };

// Server-rendered guard around every route under `(pos)/`. Only ADMIN and
// POS_STAFF get in; everyone else is bounced. Role is re-checked against the DB
// (not just the JWT) so access changes apply immediately on the next load.

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?from=/pos");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true },
  });
  if (!me || !me.isActive || !POS_ROLES.has(me.role)) {
    redirect("/");
  }

  return <>{children}</>;
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// Typeahead customer search for the POS — matches name / phone / email across
// registered users AND past order contacts (walk-ins who were never accounts).
// Returns a small deduped list of { name, phone, email }.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const [users, orders] = await Promise.all([
    db.user.findMany({
      where: {
        role: "CUSTOMER",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, phone: true, email: true },
      take: 8,
    }),
    db.order.findMany({
      where: {
        billingName: { not: null },
        OR: [
          { billingName: { contains: q, mode: "insensitive" } },
          { billingPhone: { contains: q } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { billingName: true, billingPhone: true, billingEmail: true },
      take: 12,
    }),
  ]);

  // Dedupe by phone (fallback to name) — users first (they carry loyalty). `id`
  // is the registered-account id when this contact is a real user (null for
  // order-only walk-ins), so callers can hard-link to the account.
  const seen = new Set<string>();
  const out: { id: string | null; name: string; phone: string; email: string }[] = [];
  const push = (id: string | null, name: string | null, phone: string | null, email: string | null) => {
    const key = (phone || name || "").toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ id, name: name ?? "", phone: phone ?? "", email: email ?? "" });
  };
  for (const u of users) push(u.id, u.name, u.phone, u.email);
  for (const o of orders) push(null, o.billingName, o.billingPhone, o.billingEmail);

  return NextResponse.json({ customers: out.slice(0, 8) });
}

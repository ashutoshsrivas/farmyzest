export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRound, Store } from "lucide-react";
import { db } from "@/lib/db";
import { CustomersTable, type CustomerRow } from "./_components/CustomersTable";

// Last-10-digits key so "+91 98765 43210", "098765 43210", "9876543210" all
// match the same person when reconciling order contacts with accounts.
function phoneKey(p?: string | null): string {
  const d = (p ?? "").replace(/\D/g, "");
  return d.slice(-10);
}

type Row = CustomerRow;

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  // ── Registered accounts ──────────────────────────────────────────────────
  const users = await db.user.findMany({
    where: { role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      loyaltyPoints: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Order stats per registered user (exclude cancelled/returned from spend).
  const userIds = users.map((u) => u.id);
  const userStats = userIds.length
    ? await db.order.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, status: { notIn: ["CANCELLED", "RETURNED"] } },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      })
    : [];
  const statByUser = new Map(
    userStats.map((s) => [
      s.userId,
      { orders: s._count._all, spent: s._sum.total ?? 0, last: s._max.createdAt },
    ])
  );

  // ── Guest / POS contacts (orders with a phone but no account) ────────────
  // Grouped by phone; representative name = most recent billingName.
  // Group by the NORMALISED phone (last 10 digits) — not the raw string — so
  // the same person billed as "9897282141" and "+91 98972 82141" folds into a
  // single guest row showing all their bills, instead of splitting in two.
  const guestAgg = await db.$queryRaw<
    { phone: string; name: string | null; orders: bigint; spent: number | null; last: Date }[]
  >`
    SELECT RIGHT(REGEXP_REPLACE(o."billingPhone", '[^0-9]', '', 'g'), 10) AS phone,
           (ARRAY_AGG(o."billingName" ORDER BY o."createdAt" DESC))[1] AS name,
           COUNT(*) AS orders,
           COALESCE(SUM(o.total), 0) AS spent,
           MAX(o."createdAt") AS last
    FROM "Order" o
    WHERE o."userId" IS NULL
      AND o."billingPhone" IS NOT NULL
      AND o."billingPhone" <> ''
      AND o.status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY RIGHT(REGEXP_REPLACE(o."billingPhone", '[^0-9]', '', 'g'), 10)
  `;

  // Count walk-in orders with NO contact at all — explains customers < orders.
  const walkInAgg = await db.$queryRaw<{ orders: bigint; spent: number | null }[]>`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS spent
    FROM "Order"
    WHERE "userId" IS NULL
      AND ("billingPhone" IS NULL OR "billingPhone" = '')
      AND status NOT IN ('CANCELLED', 'RETURNED')
  `;
  const walkIn = {
    orders: Number(walkInAgg[0]?.orders ?? 0),
    spent: Number(walkInAgg[0]?.spent ?? 0),
  };

  // Phones that belong to a registered account fold into that account, so we
  // don't list the same person twice.
  const accountPhoneKeys = new Set(users.map((u) => phoneKey(u.phone)).filter(Boolean));

  // ── Build the unified row list ───────────────────────────────────────────
  const accountRows: Row[] = users.map((u) => {
    const st = statByUser.get(u.id);
    return {
      kind: "account",
      id: u.id,
      phone: u.phone,
      name: u.name,
      email: u.email,
      orders: st?.orders ?? 0,
      spent: st?.spent ?? 0,
      points: u.loyaltyPoints,
      isActive: u.isActive,
      lastActivity: (st?.last ?? u.createdAt).getTime(),
    };
  });

  const guestRows: Row[] = guestAgg
    .filter((g) => !accountPhoneKeys.has(phoneKey(g.phone)))
    .map((g) => ({
      kind: "guest",
      phone: g.phone,
      name: g.name?.trim() || "Guest",
      email: null,
      orders: Number(g.orders),
      spent: Number(g.spent ?? 0),
      points: null,
      isActive: true,
      lastActivity: new Date(g.last).getTime(),
    }));

  const all = [...accountRows, ...guestRows];
  all.sort((a, b) => b.lastActivity - a.lastActivity);
  const total = all.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <UserRound className="w-5 h-5 text-nate-grey-700" />
          <h1 className="text-2xl font-serif text-nate-grey-800">Customers</h1>
        </div>
        <span className="text-sm text-nate-grey-500">
          {total} total · {accountRows.length} account{accountRows.length === 1 ? "" : "s"} ·{" "}
          {guestRows.length} guest
        </span>
      </div>

      {/* Walk-in reconciliation note */}
      {walkIn.orders > 0 && (
        <div className="bg-nate-grey-100 border border-nate-grey-200 rounded-xl px-4 py-3 mb-4 text-sm text-nate-grey-600 flex items-center gap-2">
          <Store className="w-4 h-4 shrink-0" />
          <span>
            {walkIn.orders} POS walk-in order{walkIn.orders === 1 ? "" : "s"} (₹
            {walkIn.spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}) had no
            customer details captured, so they don&apos;t appear below. Enter a name/phone at
            POS checkout to attach future sales to a customer.
          </span>
        </div>
      )}

      <CustomersTable rows={all} />
    </div>
  );
}

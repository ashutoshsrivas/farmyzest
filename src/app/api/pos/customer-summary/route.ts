export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// Customer snapshot for the POS right sidebar — keyed by phone. Aggregates the
// customer's order history (POS + online) into the figures Vasy shows:
// last visit, last bill, most-purchased item, total purchase, dues, loyalty.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "");
  if (raw.length < 10) return NextResponse.json({ found: false });
  const last10 = raw.slice(-10);

  const [orders, creditNotes] = await Promise.all([
    db.order.findMany({
      where: {
        status: { notIn: ["CANCELLED", "RETURNED"] },
        OR: [{ billingPhone: { contains: last10 } }, { user: { phone: { contains: last10 } } }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        total: true,
        paidCredit: true,
        paymentMethod: true,
        createdAt: true,
        billingName: true,
        user: { select: { name: true, loyaltyPoints: true } },
        items: { select: { productName: true, quantity: true } },
      },
    }),
    // Credit notes issued to this phone (shown at the counter). Keyed on the
    // same normalized last-10 the wallet uses.
    db.creditNote.findMany({
      where: { phoneNormalized: last10, redeemedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, note: true, createdAt: true, name: true },
    }),
  ]);

  // A customer with only a credit note (no purchase history yet) should still
  // surface at the counter, so gate on either source being present.
  if (orders.length === 0 && creditNotes.length === 0) {
    return NextResponse.json({ found: false });
  }

  const totalPurchase = orders.reduce((s, o) => s + o.total, 0);
  const duePayment = orders.reduce((s, o) => s + (o.paidCredit ?? 0), 0);
  const last = orders[0] ?? null;

  // Most-purchased item by total quantity across all their orders.
  const qtyByName = new Map<string, number>();
  for (const o of orders) for (const it of o.items) qtyByName.set(it.productName, (qtyByName.get(it.productName) ?? 0) + it.quantity);
  let mostPurchasedItem: string | null = null;
  let topQty = 0;
  for (const [name, qty] of qtyByName) if (qty > topQty) { topQty = qty; mostPurchasedItem = name; }

  const creditNoteTotal = creditNotes.reduce((s, n) => s + n.amount, 0);

  return NextResponse.json({
    found: true,
    name: last?.user?.name ?? last?.billingName ?? creditNotes[0]?.name ?? null,
    visits: orders.length,
    lastVisited: last ? last.createdAt.toISOString() : null,
    lastBillAmount: last?.total ?? 0,
    lastPaymentMode: last?.paymentMethod ?? null,
    mostPurchasedItem,
    totalPurchase,
    duePayment,
    loyaltyPoints: last?.user?.loyaltyPoints ?? 0,
    creditNotes: creditNotes.map((n) => ({
      id: n.id,
      amount: n.amount,
      note: n.note,
      createdAt: n.createdAt.toISOString(),
    })),
    creditNoteTotal,
  });
}

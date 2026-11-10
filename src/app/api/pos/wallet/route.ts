import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/wallet";

// GET /api/pos/wallet?phone=...
// POS-staff lookup of a customer's store-credit balance by phone, so the
// cashier can offer to deduct it from the bill. Read-only.

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = normalizePhone(req.nextUrl.searchParams.get("phone") ?? "");
  if (phone.length < 10) {
    return NextResponse.json({ balance: 0, phone: "", exists: false, name: null });
  }

  // Pull the balance and the customer's known name in parallel so the till can
  // auto-fill the name when a returning customer's number is entered. Name = a
  // registered account's name, else the most recent name billed to this phone.
  const [wallet, user, lastOrder] = await Promise.all([
    db.wallet.findUnique({ where: { phone }, select: { balance: true } }),
    db.user.findFirst({ where: { phone }, select: { name: true } }),
    db.order.findFirst({
      where: { billingPhone: phone, billingName: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { billingName: true },
    }),
  ]);

  return NextResponse.json({
    phone,
    balance: wallet?.balance ?? 0,
    exists: !!wallet,
    name: user?.name ?? lastOrder?.billingName ?? null,
  });
}

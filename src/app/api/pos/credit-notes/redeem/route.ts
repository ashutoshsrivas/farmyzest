export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone, getOrCreateWallet, creditWallet } from "@/lib/wallet";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// Redeem a customer's outstanding credit notes into their store-credit wallet.
// The wallet is then spent at the counter via the existing "Apply store credit"
// flow. Redemption is all-or-nothing per note (the note's full value moves to
// the wallet, where it can be partially spent). Keyed on normalized phone.
const schema = z.object({ phone: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (phone.length < 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone" }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Lock in the set of notes to redeem, then move their total to the wallet.
      const notes = await tx.creditNote.findMany({
        where: { phoneNormalized: phone, redeemedAt: null },
        select: { id: true, amount: true },
      });
      const total = notes.reduce((s, n) => s + n.amount, 0);
      if (notes.length === 0 || total <= 0) {
        return { redeemed: 0, balance: null as number | null };
      }
      const wallet = await getOrCreateWallet(tx, phone);
      if (!wallet) return { redeemed: 0, balance: null as number | null };

      const now = new Date();
      const balance = await creditWallet(
        tx,
        wallet.id,
        total,
        "ADJUSTMENT",
        `Credit note${notes.length > 1 ? `s (${notes.length})` : ""} redeemed`
      );
      await tx.creditNote.updateMany({
        where: { id: { in: notes.map((n) => n.id) } },
        data: { redeemedAt: now },
      });
      return { redeemed: total, balance };
    });

    if (result.redeemed <= 0) {
      return NextResponse.json({ error: "No credit notes to redeem." }, { status: 400 });
    }
    return NextResponse.json({ success: true, redeemed: result.redeemed, balance: result.balance });
  } catch (err) {
    console.error("[credit-notes redeem]", err);
    return NextResponse.json({ error: "Failed to redeem credit" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateWallet, creditWallet, debitWallet } from "@/lib/wallet";

// PATCH /api/admin/customers/[id]
// Admin customer management:
//   • loyaltyDelta — add/subtract loyalty points (floored at 0), recorded as a
//     LoyaltyTransaction so the balance has an audit trail.
//   • isActive — enable/disable the account.

const patchSchema = z.object({
  loyaltyDelta: z.number().optional(),
  loyaltyNote: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  // Manual store-credit adjustment (+ credit / - debit). Needs the account to
  // have a phone so we can key the wallet.
  walletDelta: z.number().optional(),
  walletNote: z.string().max(200).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { loyaltyDelta, loyaltyNote, isActive, walletDelta, walletNote } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, loyaltyPoints: true, phone: true },
    });
    if (!user || user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // A wallet is keyed by phone — block adjustments on accounts without one.
    if (typeof walletDelta === "number" && walletDelta !== 0) {
      const digits = (user.phone ?? "").replace(/\D/g, "");
      if (digits.length < 10) {
        return NextResponse.json(
          { error: "Add a 10-digit phone to this customer before adjusting store credit." },
          { status: 400 }
        );
      }
    }

    const updated = await db.$transaction(async (tx) => {
      if (typeof loyaltyDelta === "number" && loyaltyDelta !== 0) {
        // Floor the balance at 0 so a large debit can't go negative.
        const newBalance = Math.max(0, user.loyaltyPoints + loyaltyDelta);
        const applied = newBalance - user.loyaltyPoints; // actual change after floor
        await tx.user.update({
          where: { id },
          data: { loyaltyPoints: newBalance },
        });
        await tx.loyaltyTransaction.create({
          data: {
            userId: id,
            points: applied,
            type: applied >= 0 ? "EARN" : "REDEEM",
            description: loyaltyNote?.trim() || "Admin adjustment",
          },
        });
      }
      if (typeof isActive === "boolean") {
        await tx.user.update({ where: { id }, data: { isActive } });
      }
      // Manual wallet adjustment, recorded as a WalletTransaction.
      if (typeof walletDelta === "number" && walletDelta !== 0) {
        const wallet = await getOrCreateWallet(tx, user.phone);
        if (wallet) {
          const desc = walletNote?.trim() || "Admin adjustment";
          if (walletDelta > 0) {
            await creditWallet(tx, wallet.id, walletDelta, "ADJUSTMENT", desc);
          } else {
            await debitWallet(tx, wallet.id, -walletDelta, "ADJUSTMENT", desc);
          }
        }
      }
      const u = await tx.user.findUnique({
        where: { id },
        select: { id: true, loyaltyPoints: true, isActive: true },
      });
      const w = await tx.wallet.findFirst({
        where: { OR: [{ userId: id }, { phone: (user.phone ?? "").replace(/\D/g, "").slice(-10) }] },
        select: { balance: true },
      });
      return { ...u, walletBalance: w?.balance ?? 0 };
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (err) {
    console.error("[admin customers PATCH]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

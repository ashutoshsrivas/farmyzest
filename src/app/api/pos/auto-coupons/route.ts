import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/pos/auto-coupons — the active automatic spend-tier coupons, so the
// POS can preview the cart-value discount live (the order endpoint re-computes
// authoritatively). Shaped to feed @/lib/discount's engine directly.

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

export async function GET() {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const coupons = await db.coupon.findMany({
    where: { autoApply: true, isActive: true },
    select: {
      code: true,
      type: true,
      value: true,
      minCartValue: true,
      maxDiscount: true,
      includeCategoryIds: true,
      excludeCategoryIds: true,
      validFrom: true,
      validUntil: true,
      isActive: true,
      usageLimit: true,
      timesUsed: true,
    },
  });

  return NextResponse.json({ coupons });
}

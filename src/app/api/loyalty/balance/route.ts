import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureLoyaltyConfig } from "@/lib/loyalty";

// GET /api/loyalty/balance
// Returns the current user's loyaltyPoints + the active LoyaltyConfig so the
// checkout can render "You have N points (worth ₹X) — redeem up to Y".
// Auth required — anonymous users have no balance to surface.

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, config] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { loyaltyPoints: true },
    }),
    ensureLoyaltyConfig(),
  ]);

  return NextResponse.json({
    balance: user?.loyaltyPoints ?? 0,
    // Only surface redemption config while the program is enabled.
    config: config.isActive
      ? {
          rupeeValuePerPoint: config.rupeeValuePerPoint,
          minRedeemAmount: config.minRedeemAmount,
          pointsPer100Rupees: config.pointsPer100Rupees,
        }
      : null,
  });
}

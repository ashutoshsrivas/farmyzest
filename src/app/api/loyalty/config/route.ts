import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET is intentionally public-readable: the storefront checkout displays the
// loyalty rate to logged-out shoppers ("earn 1 point per ₹100"). Mutations
// (POST/PUT) are admin-only.

export async function GET() {
  try {
    const config = await db.loyaltyConfig.findFirst({ take: 1 });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { pointsPer100Rupees, rupeeValuePerPoint, minRedeemAmount, isActive } = body;
    const config = await db.loyaltyConfig.create({
      data: {
        pointsPer100Rupees: pointsPer100Rupees ?? 1,
        rupeeValuePerPoint: rupeeValuePerPoint ?? 0.25,
        minRedeemAmount: minRedeemAmount ?? 100,
        isActive: isActive ?? true,
      },
    });
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/loyalty/config error:", error);
    return NextResponse.json({ error: "Failed to create config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const config = await db.loyaltyConfig.update({ where: { id }, data });
    return NextResponse.json(config);
  } catch (error) {
    console.error("PUT /api/loyalty/config error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}

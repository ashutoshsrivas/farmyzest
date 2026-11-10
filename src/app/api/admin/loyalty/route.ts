import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await db.loyaltyConfig.findFirst({ take: 1 });
    const topCustomers = await db.user.findMany({
      where: { role: "CUSTOMER", loyaltyPoints: { gt: 0 } },
      orderBy: { loyaltyPoints: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      config: config ?? {
        pointsPer100Rupees: 1,
        rupeeValuePerPoint: 0.25,
        minRedeemAmount: 100,
        isActive: true,
      },
      topCustomers,
    });
  } catch (error) {
    console.error("GET /api/admin/loyalty error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateConfigSchema = z.object({
  pointsPer100Rupees: z.number().min(0).optional(),
  rupeeValuePerPoint: z.number().min(0).optional(),
  minRedeemAmount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = updateConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const config = await db.loyaltyConfig.findFirst({ take: 1 });
    if (config) {
      await db.loyaltyConfig.update({ where: { id: config.id }, data: parsed.data });
    } else {
      await db.loyaltyConfig.create({ data: parsed.data });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/loyalty error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
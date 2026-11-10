import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

async function isAdmin() {
  const session = await auth();
  return !!session?.user && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coupons });
}

const couponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  type: z.enum(["PERCENT", "FLAT", "FREE_SHIPPING"]),
  value: z.number().min(0),
  minCartValue: z.number().min(0).default(0),
  maxDiscount: z.number().min(0).nullable().optional(),
  includeCategoryIds: z.array(z.string()).default([]),
  excludeCategoryIds: z.array(z.string()).default([]),
  usageLimit: z.number().int().min(0).nullable().optional(),
  perUserLimit: z.number().int().min(0).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  // Auto-apply (spend tier) — applied automatically by cart value, no code needed.
  autoApply: z.boolean().default(false),
});

const toDate = (s?: string | null) => (s ? new Date(s) : null);

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = couponSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;
    const coupon = await db.coupon.create({
      data: {
        code: d.code.toUpperCase(),
        type: d.type,
        value: d.value,
        minCartValue: d.minCartValue,
        maxDiscount: d.maxDiscount ?? null,
        includeCategoryIds: d.includeCategoryIds,
        excludeCategoryIds: d.excludeCategoryIds,
        usageLimit: d.usageLimit ?? null,
        perUserLimit: d.perUserLimit ?? null,
        validFrom: toDate(d.validFrom),
        validUntil: toDate(d.validUntil),
        isActive: d.isActive,
        autoApply: d.autoApply,
      },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    console.error("POST /api/admin/coupons error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateSchema = couponSchema.partial().extend({ id: z.string().min(1) });

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { id, code, validFrom, validUntil, maxDiscount, usageLimit, perUserLimit, ...rest } =
      parsed.data;
    const coupon = await db.coupon.update({
      where: { id },
      data: {
        ...rest,
        ...(code !== undefined ? { code: code.toUpperCase() } : {}),
        ...(maxDiscount !== undefined ? { maxDiscount: maxDiscount ?? null } : {}),
        ...(usageLimit !== undefined ? { usageLimit: usageLimit ?? null } : {}),
        ...(perUserLimit !== undefined ? { perUserLimit: perUserLimit ?? null } : {}),
        ...(validFrom !== undefined ? { validFrom: toDate(validFrom) } : {}),
        ...(validUntil !== undefined ? { validUntil: toDate(validUntil) } : {}),
      },
    });
    return NextResponse.json(coupon);
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    console.error("PUT /api/admin/coupons error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID query parameter is required" }, { status: 400 });
    await db.coupon.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    console.error("DELETE /api/admin/coupons error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

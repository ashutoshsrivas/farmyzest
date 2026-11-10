import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { syncLastPieceSpecial } from "@/lib/last-piece";

const ADMIN = async () => {
  const session = await auth();
  return !!session?.user && session.user.role === "ADMIN";
};

// GET /api/admin/brands — every brand with its live product count, ordered for
// the management list.
export async function GET() {
  if (!(await ADMIN())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const brands = await db.brand.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ brands });
  } catch (error) {
    console.error("GET /api/admin/brands error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const brandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  // Discount caps (general / online / POS) — most restrictive of product /
  // category / brand wins.
  maxDiscountPct: z.number().min(0).max(100).nullable().optional(),
  maxOnlineDiscountPct: z.number().min(0).max(100).nullable().optional(),
  maxPosDiscountPct: z.number().min(0).max(100).nullable().optional(),
  // Flat auto-discounts (online + POS), like a category's.
  discountPct: z.number().min(0).max(100).nullable().optional(),
  posDiscountPct: z.number().min(0).max(100).nullable().optional(),
  excludeFromLastPiece: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await ADMIN())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = brandSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    const brand = await db.brand.create({ data: parsed.data });
    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateBrandSchema = brandSchema.partial();

export async function PUT(req: NextRequest) {
  if (!(await ADMIN())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "Brand ID required" }, { status: 400 });
    const parsed = updateBrandSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const brand = await db.brand.update({ where: { id }, data: parsed.data });

    // Keep the denormalised Product.brand string in sync on a rename, so legacy
    // storefront brand filters / displays follow the new name.
    if (parsed.data.name !== undefined) {
      await db.product.updateMany({ where: { brandId: id }, data: { brand: brand.name } });
    }

    // Opting out of last-piece: pull any auto-placed products of this brand back
    // out of Special Prices immediately (mirrors the category behaviour).
    if (parsed.data.excludeFromLastPiece === true) {
      const affected = await db.product.findMany({
        where: { autoSpecialPrice: true, brandId: id },
        select: { id: true },
      });
      for (const p of affected) await syncLastPieceSpecial(db, p.id);
    }

    return NextResponse.json(brand);
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    if (error.code === "P2002") return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await ADMIN())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const productCount = await db.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${productCount} product(s) are assigned to this brand` },
        { status: 409 }
      );
    }
    await db.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

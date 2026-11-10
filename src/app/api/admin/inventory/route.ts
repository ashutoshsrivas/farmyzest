import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncLastPieceForVariants } from "@/lib/last-piece";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const variants = await db.productVariant.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    });

    const result = variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      priceOverride: v.priceOverride,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      isLowStock: v.stock <= v.lowStockThreshold,
      product: {
        id: v.product.id,
        name: v.product.name,
        slug: v.product.slug,
        status: v.product.status,
        primaryImage: v.product.images[0]?.url ?? null,
      },
    }));

    return NextResponse.json({ variants: result });
  } catch (error) {
    console.error("GET /api/admin/inventory error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const updates: Array<{ variantId: string; stock: number }> = body.updates;

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "updates must be an array" }, { status: 400 });
    }

    await Promise.all(
      updates.map(({ variantId, stock }) =>
        db.productVariant.update({
          where: { id: variantId },
          data: { stock: Math.max(0, Math.round(stock)) },
        })
      )
    );

    // A manual stock edit can cross the last-piece boundary either way.
    await syncLastPieceForVariants(db, updates.map((u) => u.variantId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/inventory error:", error);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}
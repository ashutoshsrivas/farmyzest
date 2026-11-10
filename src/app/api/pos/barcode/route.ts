import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POS-staff-only: anonymous callers could otherwise enumerate barcodes to
// snoop inventory + pricing. The POS UI is itself guarded by (pos)/layout,
// so by the time this endpoint is hit there's always a session cookie.
const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

/**
 * GET /api/pos/barcode?barcode=XXX
 * Looks up a ProductVariant by barcode and returns the variant with product info.
 * Returns 404 if not found.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barcode = req.nextUrl.searchParams.get("barcode");

  if (!barcode || barcode.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'barcode' query parameter" }, { status: 400 });
  }

  try {
    // Match a SKU or barcode, case-insensitively (ss02358 == SS02358).
    const code = barcode.trim();
    const variant = await db.productVariant.findFirst({
      where: {
        OR: [
          { barcode: { equals: code, mode: "insensitive" } },
          { sku: { equals: code, mode: "insensitive" } },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            mrp: true,
            onlinePrice: true,
            salePrice: true,
            sellingPrice: true,
            status: true,
            category: { select: { id: true, name: true, slug: true, posDiscountPct: true } },
            brandRef: { select: { posDiscountPct: true } },
            taxSlab: { select: { id: true, name: true, percentage: true } },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true, alt: true },
            },
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { error: `No product found with barcode: ${barcode}` },
        { status: 404 }
      );
    }

    // Determine the effective selling price
    const effectivePrice =
      variant.priceOverride ?? variant.product.onlinePrice ?? variant.product.mrp;

    // Calculate tax amount for this variant
    const taxPercent = variant.product.taxSlab?.percentage ?? 0;
    const taxAmount = Math.round((effectivePrice * taxPercent) / 100);
    const priceWithTax = effectivePrice + taxAmount;

    return NextResponse.json({
      variantId: variant.id,
      productId: variant.product.id,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
      colorHex: variant.colorHex,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      isInStock: variant.stock > 0,
      isLowStock: variant.stock > 0 && variant.stock <= variant.lowStockThreshold,
      product: {
        name: variant.product.name,
        slug: variant.product.slug,
        status: variant.product.status,
        category: variant.product.category,
        // Flat POS auto-discount — the better (larger) of the category and brand
        // values. The POS client applies it in getVariantPrice(), so sellingPrice
        // here stays the raw list price to avoid discounting twice.
        categoryPosDiscountPct:
          Math.max(
            variant.product.category?.posDiscountPct ?? 0,
            variant.product.brandRef?.posDiscountPct ?? 0
          ) || null,
        mrp: variant.product.mrp,
        onlinePrice: variant.product.onlinePrice,
        salePrice: variant.product.salePrice,
        sellingPrice: effectivePrice,
        taxSlab: variant.product.taxSlab,
        priceWithTax,
        taxPercent,
        imageUrl: variant.product.images[0]?.url ?? null,
      },
    });
  } catch (err) {
    console.error("[POS Barcode] Error:", err);
    return NextResponse.json({ error: "Failed to look up barcode" }, { status: 500 });
  }
}
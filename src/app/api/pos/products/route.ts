import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { minCapPct } from "@/lib/pricing";

// POS-staff-only product listing.
//
// Why a dedicated endpoint instead of /api/products?
//   The POS UI accesses `variant.product.sellingPrice`, `variant.product.taxSlab`,
//   and `variant.images` on each ProductVariant. Prisma's default Product →
//   Variant include returns variants without a back-reference to their parent
//   product, so the storefront /api/products response misses the fields POS
//   needs and the UI crashes on first render. We do the parent-product +
//   images injection here once, server-side, so the POS client can stay dumb.
//
// Auth: POS_STAFF or ADMIN. The POS page is also guarded by (pos)/layout, so
// callers always have a session cookie by the time they hit this route.

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 60 : rawLimit), 200);

  const where: Prisma.ProductWhereInput = {
    // POS sells from the full catalogue, including DRAFT products (a freshly
    // received item not yet published online should still be billable). Only
    // ARCHIVED (retired) products are hidden.
    status: { in: ["ACTIVE", "DRAFT"] },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            // POS staff often know a product by brand even if the customer-
            // facing UI only shows the product name. Make brand part of the
            // search predicate so scanning fails over to typing "Nike" etc.
            { brand: { contains: search, mode: "insensitive" } },
            { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
            { variants: { some: { barcode: { contains: search } } } },
          ],
        }
      : {}),
  };

  try {
    const products = await db.product.findMany({
      where,
      // Latest first — the most recently added products surface at the top.
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        mrp: true,
        onlinePrice: true,
        sellingPrice: true,
        maxDiscountPct: true,
        category: { select: { maxDiscountPct: true, maxPosDiscountPct: true, posDiscountPct: true } },
        brandRef: { select: { maxDiscountPct: true, maxPosDiscountPct: true, posDiscountPct: true } },
        taxSlab: { select: { percentage: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            size: true,
            color: true,
            colorHex: true,
            priceOverride: true,
            stock: true,
            lowStockThreshold: true,
          },
          orderBy: [{ color: "asc" }, { size: "asc" }],
        },
        images: {
          select: { url: true, isPrimary: true, alt: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
      },
    });

    // Inject the parent product + image list into each variant so the POS UI's
    // `getVariantPrice(v)` / `getVariantImage(v)` helpers work without null
    // guards on every call site.
    const enriched = products.map((p) => {
      // Flatten the category + brand caps so the POS can compute a per-line
      // discount cap without another lookup (most restrictive wins). The POS
      // auto-discount = the better (larger) of the category and brand values.
      const categoryMaxDiscountPct = minCapPct(
        p.category?.maxDiscountPct,
        p.category?.maxPosDiscountPct,
        p.brandRef?.maxDiscountPct,
        p.brandRef?.maxPosDiscountPct
      );
      const categoryPosDiscountPct =
        Math.max(p.category?.posDiscountPct ?? 0, p.brandRef?.posDiscountPct ?? 0) || null;
      return {
        ...p,
        categoryMaxDiscountPct,
        categoryPosDiscountPct,
        variants: p.variants.map((v) => ({
          ...v,
          product: {
            id: p.id,
            name: p.name,
            mrp: p.mrp,
            onlinePrice: p.onlinePrice,
            sellingPrice: p.sellingPrice,
            maxDiscountPct: p.maxDiscountPct,
            categoryMaxDiscountPct,
            categoryPosDiscountPct,
            taxSlab: p.taxSlab,
          },
          images: p.images,
        })),
      };
    });

    return NextResponse.json({ products: enriched });
  } catch (err) {
    console.error("[POS products]", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

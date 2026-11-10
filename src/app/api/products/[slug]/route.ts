import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isReseller } from "@/lib/pricing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const product = await db.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        category: true,
        collections: { include: { collection: true } },
        reviews: {
          where: { status: "APPROVED" },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        taxSlab: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Resellers see the wholesale price in place of retail. Substituting it into
    // onlinePrice + each variant's priceOverride means every downstream consumer
    // (PDP, quick-add cards, variant picker) prices the item at the reseller rate.
    const session = await auth();
    if (isReseller(session?.user?.role) && product.resellerPrice != null) {
      product.onlinePrice = product.resellerPrice;
      product.variants = product.variants.map((v) => ({ ...v, priceOverride: product.resellerPrice }));
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[slug] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
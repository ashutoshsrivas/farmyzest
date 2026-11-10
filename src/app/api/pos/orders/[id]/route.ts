export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { minCapPct } from "@/lib/pricing";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// Most-restrictive discount cap (%) — tighter of product & category. null = uncapped.
function effectiveCapPct(p?: number | null, c?: number | null): number | null {
  const caps = [p, c].filter((x): x is number => x != null);
  return caps.length ? Math.min(...caps) : null;
}

// GET /api/pos/orders/[id] — load a POS bill as POS-cart-ready data so it can be
// re-opened, edited, and re-saved in place (keeping the original date/time).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      _count: { select: { exchanges: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.source !== "POS") {
    return NextResponse.json({ error: "Only POS bills can be edited here." }, { status: 409 });
  }
  if (order.status === "CANCELLED" || order.status === "RETURNED") {
    return NextResponse.json({ error: "Cancelled / returned bills can't be edited." }, { status: 409 });
  }
  if (order._count.exchanges > 0) {
    return NextResponse.json({ error: "This bill has exchanges and can't be edited." }, { status: 409 });
  }

  // Resolve live variant data (price, stock, caps, image) for catalog lines.
  const variantIds = order.items.map((i) => i.variantId).filter((v): v is string => !!v);
  const variants = variantIds.length
    ? await db.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: { include: { category: true, taxSlab: true } } },
      })
    : [];
  const vMap = new Map(variants.map((v) => [v.id, v]));

  const items = order.items.map((it) => {
    const v = it.variantId ? vMap.get(it.variantId) : undefined;
    const listUnit = it.listPrice ?? it.unitPrice;
    return {
      variantId: it.variantId ?? `cash-${it.id}`,
      productId: it.productId,
      name: it.productName,
      variantLabel: it.variantLabel ?? "",
      sku: it.sku ?? "",
      barcode: it.barcode ?? "",
      price: listUnit,
      taxPercent: it.taxPercent ?? v?.product.taxSlab?.percentage ?? 0,
      quantity: it.quantity,
      // Editable headroom: live stock PLUS what this bill already holds.
      stock: v ? v.stock + it.quantity : 999,
      imageUrl: it.imageUrl ?? "",
      // Restore the ORIGINAL discount type + value captured at billing so a
      // percentage stays a percentage and a rupee amount stays rupees. Legacy
      // rows (no stored type) fall back to the flat ₹ amount.
      discountType: (it.discountType === "PERCENT" || it.discountType === "FIXED"
        ? it.discountType
        : "FIXED") as "PERCENT" | "FIXED",
      discountValue:
        it.discountValue != null
          ? Math.round(it.discountValue * 100) / 100
          : Math.round((it.discount ?? 0) * 100) / 100,
      maxDiscountPct: v ? effectiveCapPct(v.product.maxDiscountPct, minCapPct(v.product.category?.maxDiscountPct, v.product.category?.maxPosDiscountPct)) : null,
      salesmanId: it.salesmanId ?? "",
    };
  });

  // Bill-level discount = order discount minus the per-line discounts (lumps any
  // promo/coupon in as a flat bill discount, since they're not stored per line).
  const lineDiscTotal = order.items.reduce((s, it) => s + (it.discount ?? 0), 0);
  const billDiscountValue = Math.max(0, Math.round((order.discount - lineDiscTotal) * 100) / 100);

  return NextResponse.json({
    id: order.id,
    posOrderNum: order.posOrderNum,
    createdAt: order.createdAt.toISOString(),
    salesmanId: order.salesmanId,
    attendedById: order.attendedById,
    orderType: order.orderType ?? "WALK_IN",
    additionalCharges: order.additionalCharges ?? 0,
    roundOff: Math.abs(order.roundOff ?? 0) >= 0.005,
    notes: order.notes ?? "",
    customerName: order.billingName ?? "",
    customerPhone: order.billingPhone ?? "",
    customerEmail: order.billingEmail ?? "",
    billDiscountValue,
    payments: {
      cash: order.paidCash,
      upi: order.paidUpi,
      card: order.paidCard,
      credit: order.paidCredit,
    },
    items,
  });
}

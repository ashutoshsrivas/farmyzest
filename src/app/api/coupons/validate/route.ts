import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { minCapPct } from "@/lib/pricing";
import {
  computeDiscount,
  bestAutoTier,
  mergeBestPerLine,
  type DiscountLine,
} from "@/lib/discount";
import { rateLimit, callerIp } from "@/lib/rate-limit";

// POST /api/coupons/validate — checkout-time quote for the cart. Returns the
// automatic spend-tier discount (applied with no code) plus, optionally, the
// effect of an entered coupon code layered on top (best-per-line, not additive).
// The order endpoint re-computes authoritatively, so this is advisory.
const schema = z.object({
  code: z.string().trim().max(40).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive().max(100),
      })
    )
    .min(1),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest) {
  const ip = callerIp(req);
  const rl = rateLimit({ key: `coupon:${ip}`, max: 30, windowMs: 60_000 });
  if (rl.limited) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { code, items } = parsed.data;

  const variants = await db.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: { include: { category: true, brandRef: true } } },
  });
  const vmap = new Map(variants.map((v) => [v.id, v]));

  const lines: DiscountLine[] = [];
  for (const it of items) {
    const v = vmap.get(it.variantId);
    if (!v) continue;
    lines.push({
      productId: v.productId,
      categoryId: v.product.categoryId,
      unitPrice: v.priceOverride ?? v.product.onlinePrice ?? v.product.mrp,
      quantity: it.quantity,
      productMaxDiscountPct: v.product.maxDiscountPct ?? null,
      // Online-effective cap = general cap tightened by the online cap, across
      // both the product's category AND its brand (most restrictive wins).
      categoryMaxDiscountPct: minCapPct(
        v.product.category.maxDiscountPct,
        v.product.category.maxOnlineDiscountPct,
        v.product.brandRef?.maxDiscountPct,
        v.product.brandRef?.maxOnlineDiscountPct
      ),
    });
  }
  if (lines.length === 0) {
    return NextResponse.json({ autoDiscount: 0, autoLabel: null, code: null, discount: 0, freeShipping: false });
  }

  // Automatic spend tier (no code).
  const autoCoupons = await db.coupon.findMany({ where: { autoApply: true, isActive: true } });
  const autoTier = bestAutoTier(autoCoupons, lines);
  const autoDiscount = autoTier?.result.discountTotal ?? 0;

  // Optional entered code.
  let codeResult = null as ReturnType<typeof computeDiscount> | null;
  let codeCouponCode = "";
  let codeInfo:
    | null
    | { valid: true; code: string; extra: number }
    | { valid: false; message: string } = null;

  if (code) {
    const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) {
      codeInfo = { valid: false, message: "Invalid coupon code." };
    } else {
      const r = computeDiscount(coupon, lines);
      if (!r.valid) {
        codeInfo = { valid: false, message: r.reason };
      } else {
        codeResult = r;
        codeCouponCode = coupon.code;
      }
    }
  }

  const merged = mergeBestPerLine(lines, [autoTier?.result, codeResult]);
  const discount = merged.discountTotal;

  // The code only "counts" if it beats the automatic discount somewhere.
  if (code && codeResult) {
    const extra = round2(discount - autoDiscount);
    codeInfo =
      extra > 0
        ? { valid: true, code: codeCouponCode, extra }
        : { valid: false, message: "This code doesn't beat your automatic discount." };
  }

  return NextResponse.json({
    autoDiscount,
    autoLabel: autoTier ? `Spend discount (${autoTier.coupon.value}%)` : null,
    code: codeInfo,
    discount,
    freeShipping: merged.freeShipping,
  });
}

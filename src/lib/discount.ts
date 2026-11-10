import type { CouponType } from "@prisma/client";

// Pure coupon/discount engine. No DB, no I/O — given the cart lines (with their
// per-product/category caps) and a coupon, it returns the per-line and total
// discount. Used by both /api/coupons/validate (checkout preview) and
// /api/orders (authoritative re-compute at order time) so the two never drift.

export type DiscountLine = {
  productId: string;
  categoryId: string;
  unitPrice: number;
  quantity: number;
  // Most-restrictive caps, as a percentage. null = uncapped.
  productMaxDiscountPct: number | null;
  categoryMaxDiscountPct: number | null;
};

export type CouponInput = {
  code: string;
  type: CouponType; // PERCENT | FLAT | FREE_SHIPPING
  value: number;
  minCartValue: number;
  maxDiscount: number | null;
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
  usageLimit: number | null;
  timesUsed: number;
};

export type LineBreakdown = DiscountLine & {
  discountPct: number;
  discountAmount: number;
};

export type DiscountResult =
  | { valid: false; reason: string }
  | {
      valid: true;
      discountTotal: number; // rupees off the cart (item discount, pre-tax)
      freeShipping: boolean;
      lines: LineBreakdown[];
    };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeDiscount(
  coupon: CouponInput,
  lines: DiscountLine[],
  now: Date = new Date()
): DiscountResult {
  if (!coupon.isActive) return { valid: false, reason: "This coupon is not active." };
  if (coupon.validFrom && now < coupon.validFrom)
    return { valid: false, reason: "This coupon isn't valid yet." };
  if (coupon.validUntil && now > coupon.validUntil)
    return { valid: false, reason: "This coupon has expired." };
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit)
    return { valid: false, reason: "This coupon has reached its usage limit." };

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (subtotal < coupon.minCartValue) {
    const gap = Math.ceil(coupon.minCartValue - subtotal);
    return { valid: false, reason: `Add ₹${gap.toLocaleString("en-IN")} more to use this coupon.` };
  }

  const include = coupon.includeCategoryIds ?? [];
  const exclude = coupon.excludeCategoryIds ?? [];
  const eligible = (l: DiscountLine) =>
    (include.length === 0 || include.includes(l.categoryId)) && !exclude.includes(l.categoryId);

  if (coupon.type === "FREE_SHIPPING") {
    return {
      valid: true,
      discountTotal: 0,
      freeShipping: true,
      lines: lines.map((l) => ({ ...l, discountPct: 0, discountAmount: 0 })),
    };
  }

  if (coupon.type === "FLAT") {
    // Flat ₹ off the eligible subtotal, capped at it (never pay the customer).
    const eligibleSubtotal = lines
      .filter(eligible)
      .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const total = Math.min(coupon.value, eligibleSubtotal, coupon.maxDiscount ?? Infinity);
    const lineBreakdown: LineBreakdown[] = lines.map((l) => {
      const lineGross = l.unitPrice * l.quantity;
      if (!eligible(l) || eligibleSubtotal === 0 || lineGross === 0)
        return { ...l, discountPct: 0, discountAmount: 0 };
      // Spread the flat amount across eligible lines proportionally.
      const amount = round2((lineGross / eligibleSubtotal) * total);
      return { ...l, discountPct: round2((amount / lineGross) * 100), discountAmount: amount };
    });
    if (total <= 0)
      return { valid: false, reason: "This coupon gives no discount on your current items." };
    return { valid: true, discountTotal: round2(total), freeShipping: false, lines: lineBreakdown };
  }

  // PERCENT — each eligible line gets the coupon %, tightened by the most
  // restrictive of its product / category cap. e.g. a 20% coupon on a cart
  // with accessories (category cap 15) gives 20% on apparel, 15% on accessories,
  // and 0% on special-price products (product cap 0).
  const lineBreakdown: LineBreakdown[] = lines.map((l) => {
    if (!eligible(l)) return { ...l, discountPct: 0, discountAmount: 0 };
    const pct = Math.max(
      0,
      Math.min(
        coupon.value,
        l.productMaxDiscountPct ?? Infinity,
        l.categoryMaxDiscountPct ?? Infinity
      )
    );
    const amount = round2(l.unitPrice * l.quantity * (pct / 100));
    return { ...l, discountPct: pct, discountAmount: amount };
  });

  let discountTotal = round2(lineBreakdown.reduce((s, l) => s + l.discountAmount, 0));
  if (coupon.maxDiscount != null && discountTotal > coupon.maxDiscount) {
    discountTotal = round2(coupon.maxDiscount);
  }
  if (discountTotal <= 0)
    return { valid: false, reason: "This coupon gives no discount on your current items." };

  return { valid: true, discountTotal, freeShipping: false, lines: lineBreakdown };
}

type ValidResult = Extract<DiscountResult, { valid: true }>;

/**
 * From a set of auto-apply spend-tier coupons, find the one that gives the
 * biggest discount on this cart (higher spend → higher tier). Returns the
 * winning coupon + its computed result, or null if none qualify.
 */
export function bestAutoTier<T extends CouponInput>(
  autoCoupons: T[],
  lines: DiscountLine[],
  now: Date = new Date()
): { coupon: T; result: ValidResult } | null {
  let best: { coupon: T; result: ValidResult } | null = null;
  for (const c of autoCoupons) {
    const r = computeDiscount(c, lines, now);
    if (r.valid && (!best || r.discountTotal > best.result.discountTotal)) {
      best = { coupon: c, result: r };
    }
  }
  return best;
}

/**
 * Combine multiple discount results by taking the BEST discount per line (never
 * additive) — used to layer an entered coupon on top of the automatic spend
 * tier so the customer keeps whichever is better per item, with no stacking.
 */
export function mergeBestPerLine(
  lines: DiscountLine[],
  results: Array<DiscountResult | null | undefined>
): { discountTotal: number; freeShipping: boolean; lines: LineBreakdown[] } {
  const valid = results.filter((r): r is ValidResult => !!r && r.valid);
  const merged: LineBreakdown[] = lines.map((l, i) => {
    let discountAmount = 0;
    let discountPct = 0;
    for (const r of valid) {
      const lb = r.lines[i];
      if (lb && lb.discountAmount > discountAmount) {
        discountAmount = lb.discountAmount;
        discountPct = lb.discountPct;
      }
    }
    return { ...l, discountPct, discountAmount };
  });
  const discountTotal = round2(merged.reduce((s, x) => s + x.discountAmount, 0));
  const freeShipping = valid.some((r) => r.freeShipping);
  return { discountTotal, freeShipping, lines: merged };
}

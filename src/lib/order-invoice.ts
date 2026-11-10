import { db } from "@/lib/db";
import { minCapPct } from "@/lib/pricing";
import { bestAutoTier, type DiscountLine } from "@/lib/discount";
import { computeInvoice, type InvoiceComputation, type InvoiceLineInput } from "@/lib/invoice";
import { attachDiscountCaps } from "@/lib/invoice-caps";

const r2 = (n: number) => Math.round(n * 100) / 100;

// A bill must reflect the discount slabs that were in effect when it was PLACED,
// and must never re-rate itself when the current offers change. The spend-tier
// thresholds were lowered on 7 Aug 2026 (IST) — the percentages were unchanged,
// only the min-cart thresholds moved — so orders split into two eras:
//   • placed before 7 Aug 2026 → the OLD (higher) thresholds below
//   • placed from 7 Aug 2026    → whatever the coupons are set to now (live)
// 7 Aug 2026 00:00 IST = 2026-08-06T18:30:00Z.
const SLAB_CHANGE_AT = new Date("2026-08-06T18:30:00.000Z");
// Old min-cart threshold per tier code (recovered from the 5-Aug DB backup).
// Everything else about each coupon (percentage, exclusions) was unchanged, so
// we clone the live rows and only swap the threshold for pre-change orders.
const OLD_SLAB_MIN_CART: Record<string, number> = {
  FLAT10: 3000,
  FLAT15: 10000,
  FLAT20: 20000,
  FLAT25: 60000,
  FLAT30: 100000,
};

// The stored order shape this module needs. Line items are OrderItem rows
// (structurally compatible with InvoiceLineInput) that also carry productId.
type OrderLine = InvoiceLineInput & {
  productId?: string | null;
  quantity: number;
  unitPrice: number;
  listPrice?: number | null;
};
type InvoiceableOrder = {
  source: string;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: Date;
  items: OrderLine[];
};

/**
 * Recompute each line's AUTOMATIC spend-tier discount from the coupons that are
 * live *right now* (not what was stored at order time), so every online order —
 * old or new — shows the real per-line % today's offers give: 15/20/25/30 by
 * spend, each tightened by the line's own max-discount cap. Returns a ₹ amount
 * per line (aligned to `items`), or all-zeros when no auto tier applies.
 *
 * The tier is chosen by the order's own gross value against the thresholds that
 * applied when it was placed (old thresholds before 7 Aug 2026, live after).
 */
async function autoTierPerLine(items: OrderLine[], placedAt: Date): Promise<number[]> {
  const ids = [...new Set(items.map((i) => i.productId).filter((v): v is string => !!v))];
  if (ids.length === 0) return items.map(() => 0);

  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      categoryId: true,
      maxDiscountPct: true,
      category: { select: { maxDiscountPct: true, maxOnlineDiscountPct: true } },
      brandRef: { select: { maxDiscountPct: true, maxOnlineDiscountPct: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: DiscountLine[] = items.map((it) => {
    const p = it.productId ? byId.get(it.productId) : undefined;
    return {
      productId: it.productId ?? "",
      categoryId: p?.categoryId ?? "",
      // The tier % applies to the pre-tier selling price per unit — that's the
      // line's list/charged price (listPrice when set, else the stored unitPrice).
      unitPrice: it.listPrice ?? it.unitPrice,
      quantity: it.quantity,
      productMaxDiscountPct: p?.maxDiscountPct ?? null,
      // Online-effective cap = general cap tightened by the online cap, across
      // the product's category AND brand (most restrictive wins).
      categoryMaxDiscountPct: minCapPct(
        p?.category?.maxDiscountPct,
        p?.category?.maxOnlineDiscountPct,
        p?.brandRef?.maxDiscountPct,
        p?.brandRef?.maxOnlineDiscountPct
      ),
    };
  });

  const liveCoupons = await db.coupon.findMany({ where: { autoApply: true, isActive: true } });
  // Before the 7-Aug slab change, re-rate against the OLD thresholds so an old
  // bill shows the tier it actually got (e.g. a ₹26k order = 20%, not today's 25%).
  const coupons =
    placedAt < SLAB_CHANGE_AT
      ? liveCoupons.map((c) =>
          OLD_SLAB_MIN_CART[c.code] != null
            ? { ...c, minCartValue: OLD_SLAB_MIN_CART[c.code] }
            : c
        )
      : liveCoupons;
  const tier = bestAutoTier(coupons, lines);
  if (!tier) return items.map(() => 0);
  return tier.result.lines.map((l) => l.discountAmount);
}

/**
 * Build the GST + discount breakup for an order's invoice / detail view.
 *
 * POS bills keep the discount that was actually rung (stored per line). ONLINE
 * orders show each line's auto-tier % (per line cap) recomputed against the slabs
 * that applied WHEN THE ORDER WAS PLACED — old thresholds before 7 Aug 2026, the
 * live coupons after — giving a clean per-line percentage instead of a blended
 * average, without re-rating old bills to today's offers.
 *
 * The breakup always foots: the effective discount is at least the recomputed
 * tier (so the real % shows) and at least what the order actually gave (so any
 * loyalty points / manual code aren't dropped); the grand total moves with it.
 * For an order placed under the offers that are still live, this is identical to
 * what was charged — the tier sum equals order.discount and nothing shifts.
 */
export async function buildOrderInvoice(
  order: InvoiceableOrder,
  defaultGstRate = 0
): Promise<InvoiceComputation> {
  const capped = await attachDiscountCaps(order.items);

  if (order.source !== "ONLINE") {
    return computeInvoice(capped, order.subtotal, order.discount, order.total, defaultGstRate);
  }

  const tierAmts = await autoTierPerLine(order.items, order.createdAt);
  const tierSum = r2(tierAmts.reduce((s, a) => s + a, 0));

  const items = capped.map((it, i) => {
    const tier = r2(tierAmts[i] ?? 0);
    if (tier <= 0) return it;
    const gross = it.listPrice ?? it.unitPrice;
    return {
      ...it,
      listPrice: gross,
      discount: tier,
      totalPrice: r2(gross * it.quantity - tier),
    };
  });

  // Effective discount = the current tier, plus anything the order gave beyond
  // it (points / a code that beat the tier) which water-fills as a bill-level
  // amount. Shift the grand total by the same delta so the breakup reconciles.
  const effectiveDiscount = Math.max(order.discount, tierSum);
  const effectiveTotal = r2(order.total - Math.max(0, tierSum - order.discount));

  return computeInvoice(items, order.subtotal, effectiveDiscount, effectiveTotal, defaultGstRate);
}

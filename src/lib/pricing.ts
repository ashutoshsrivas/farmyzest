// Viewer-aware pricing. Logged-in RESELLER accounts see (and pay) the product's
// wholesale `resellerPrice` when set; everyone else sees the normal retail price
// (variant override → online price → MRP). Reseller price is a flat per-product
// wholesale rate, so it overrides any per-variant priceOverride.
//
// Category discount: a Category can carry a flat `discountPct` that marks down
// EVERY product in it. It applies to retail shoppers only (never to reseller
// wholesale) and is folded into the returned price here, so every surface that
// prices via viewerPrice() shows the discounted value automatically.

export const isReseller = (role?: string | null) => role === "RESELLER";

/** The most-restrictive (smallest) of several % caps, ignoring null/undefined.
 *  Returns null when every cap is absent (= uncapped). Used to combine a
 *  category's general cap with its channel-specific (online / POS) cap. */
export function minCapPct(...caps: (number | null | undefined)[]): number | null {
  const vals = caps.filter((c): c is number => c != null);
  return vals.length ? Math.min(...vals) : null;
}

export type PriceableProduct = {
  resellerPrice?: number | null;
  onlinePrice?: number | null;
  mrp: number;
  // Primary category — its discountPct (if any) marks down this product.
  category?: { discountPct?: number | null } | null;
  // Brand — its discountPct works exactly like the category's (full parity).
  brandRef?: { discountPct?: number | null } | null;
};
export type PriceableVariant = { priceOverride?: number | null };

/** The category's flat discount %, clamped to a sane 0–100, or 0 if none. */
export function categoryDiscountPct(product: PriceableProduct): number {
  const pct = product.category?.discountPct ?? 0;
  if (!pct || pct <= 0) return 0;
  return Math.min(100, pct);
}

/** The brand's flat discount %, clamped to 0–100, or 0 if none. */
export function brandDiscountPct(product: PriceableProduct): number {
  const pct = product.brandRef?.discountPct ?? 0;
  if (!pct || pct <= 0) return 0;
  return Math.min(100, pct);
}

/** The auto online discount actually applied: the better (larger) of the
 *  product's category and brand flat discounts. Either alone works; when both
 *  are set the shopper gets the bigger markdown. */
export function autoOnlineDiscountPct(product: PriceableProduct): number {
  return Math.max(categoryDiscountPct(product), brandDiscountPct(product));
}

/** Apply a percentage markdown to a price, rounded to the rupee. */
export function applyDiscount(base: number, pct: number): number {
  if (!pct || pct <= 0) return base;
  return Math.round(base * (1 - pct / 100));
}

/** Retail price BEFORE any category discount (for the struck-through "was"). */
export function viewerListPrice(
  role: string | null | undefined,
  product: PriceableProduct,
  variant?: PriceableVariant | null
): number {
  if (isReseller(role) && product.resellerPrice != null) return product.resellerPrice;
  return variant?.priceOverride ?? product.onlinePrice ?? product.mrp;
}

/** The price the viewer actually pays — list price minus the category discount. */
export function viewerPrice(
  role: string | null | undefined,
  product: PriceableProduct,
  variant?: PriceableVariant | null
): number {
  const base = viewerListPrice(role, product, variant);
  // Reseller wholesale is never further discounted by a category/brand markdown.
  if (isReseller(role) && product.resellerPrice != null) return base;
  return applyDiscount(base, autoOnlineDiscountPct(product));
}

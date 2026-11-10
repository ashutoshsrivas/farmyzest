// Shared rules for picking a TaxSlab from an MRP value.
//
// Business rule (India / GST simplified for this store):
//   MRP < ₹2,500  → 5% slab
//   MRP ≥ ₹2,500  → 18% slab
//
// Both /admin/products/new and the quick-create-product modal in the
// supplier-bill flow apply this rule whenever MRP changes. The admin can
// still override the dropdown manually afterwards — but typing a new MRP
// will re-apply the rule. We do the matching by percentage rather than by
// slab ID so this keeps working if the admin renames "5% GST" → "GST 5".

export const TAX_RULE_THRESHOLD = 2500;
export const TAX_RULE_LOW_PCT = 5;
export const TAX_RULE_HIGH_PCT = 18;

export interface TaxSlabLike {
  id: string;
  percentage: number;
}

/** Target tax percentage for a given MRP (string or number tolerated). */
export function targetTaxPct(mrp: string | number): number {
  const n = typeof mrp === "number" ? mrp : parseFloat(mrp);
  if (!isFinite(n) || n <= 0) return TAX_RULE_LOW_PCT;
  return n < TAX_RULE_THRESHOLD ? TAX_RULE_LOW_PCT : TAX_RULE_HIGH_PCT;
}

/** Returns the slab whose `percentage` matches the rule for the given amount,
 *  or null if no exact match is configured. Use exact equality with a tiny
 *  epsilon so 18.0 and 18 match. Falls back to the closest slab if no exact
 *  match exists — but only when the caller passes `fallbackToClosest`.
 *
 *  The threshold rule is the same regardless of which price drives it — the
 *  caller decides whether to pass MRP or cost. */
export function pickTaxSlabForAmount<T extends TaxSlabLike>(
  slabs: T[],
  amount: string | number,
  { fallbackToClosest = false }: { fallbackToClosest?: boolean } = {}
): T | null {
  const target = targetTaxPct(amount);
  const exact = slabs.find((s) => Math.abs(s.percentage - target) < 0.001);
  if (exact) return exact;
  if (!fallbackToClosest || slabs.length === 0) return null;
  return [...slabs].sort(
    (a, b) =>
      Math.abs(a.percentage - target) - Math.abs(b.percentage - target)
  )[0]!;
}

/** Pick the slab from MRP (storefront/full product form). */
export const pickTaxSlabForMrp = pickTaxSlabForAmount;

/** Pick the slab from the purchase COST (supplier-bill quick-create flow).
 *  The owner wants tax driven by what the item cost to buy, not its MRP. */
export const pickTaxSlabForCost = pickTaxSlabForAmount;

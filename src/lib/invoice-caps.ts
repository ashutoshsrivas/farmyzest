import { db } from "@/lib/db";
import { minCapPct } from "@/lib/pricing";
import type { InvoiceLineInput } from "@/lib/invoice";

// Slugs/names we accept as the canonical "Special Prices" category (kept in
// step with src/lib/last-piece.ts).
const SPECIAL_SLUGS = ["special-prices", "special"];
const isSpecialSlug = (slug?: string | null) => !!slug && SPECIAL_SLUGS.includes(slug);

/**
 * Enrich stored order lines with the per-line max-discount cap + Special-Prices
 * flag so `computeInvoice` can spread a bill-level discount the SAME way POS
 * charged it (a capped item — e.g. a Special Prices line at 0% off — absorbs
 * none of it), instead of painting a misleading flat % on every line.
 *
 * The cap mirrors POS exactly: the tighter of the product's own cap and its
 * PRIMARY category's general / POS caps (last-piece auto items are tagged into
 * Special Prices via the m2m relation only, keeping their original primary cap,
 * so they legitimately still take a bill discount). The Special-Prices flag,
 * used only for the informational bill note, also looks at the m2m membership.
 */
export async function attachDiscountCaps<T extends InvoiceLineInput & { productId?: string | null }>(
  items: T[]
): Promise<T[]> {
  const ids = [...new Set(items.map((i) => i.productId).filter((v): v is string => !!v))];
  if (ids.length === 0) return items;

  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      maxDiscountPct: true,
      category: { select: { slug: true, maxDiscountPct: true, maxPosDiscountPct: true } },
      brandRef: { select: { maxDiscountPct: true, maxPosDiscountPct: true } },
      categories: { select: { slug: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return items.map((it) => {
    const p = it.productId ? byId.get(it.productId) : undefined;
    if (!p) return it;
    const maxDiscountCapPct = minCapPct(
      p.maxDiscountPct,
      p.category?.maxDiscountPct,
      p.category?.maxPosDiscountPct,
      p.brandRef?.maxDiscountPct,
      p.brandRef?.maxPosDiscountPct
    );
    const isSpecialPrice =
      isSpecialSlug(p.category?.slug) || p.categories.some((c) => isSpecialSlug(c.slug));
    return { ...it, maxDiscountCapPct, isSpecialPrice };
  });
}

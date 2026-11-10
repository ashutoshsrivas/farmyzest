import type { PrismaClient, Prisma } from "@prisma/client";
import { applyDiscount } from "@/lib/pricing";

// ── Last-piece auto-special-pricing ──────────────────────────────────────────
// When a product's on-hand stock falls to exactly ONE unit it is automatically
// surfaced in the "Special Prices" category and marked down by a configurable
// percentage, nudging the final piece out the door. When it's restocked above
// one, the automation reverses itself — UNLESS an admin placed it in Special
// Prices by hand (those carry `autoSpecialPrice = false`, so the revert leaves
// them untouched).
//
// The discount is applied by lowering `onlinePrice` (the original is stashed in
// `preSpecialOnlinePrice` for exact restore) and membership is added via the
// many-to-many `categories` tag — deliberately NOT by changing the primary
// category. That keeps the product on its original category page too and, more
// importantly, avoids double-discounting: the Special Prices category may carry
// its own flat `discountPct`, which only applies through a product's PRIMARY
// category, so a tag-only membership never stacks on top of our markdown.

/** Fallback markdown for a last piece ONLY when the Special Prices category has
 *  no flat discount of its own. Normally the markdown mirrors that category's
 *  `discountPct` so an auto-surfaced last piece is discounted by exactly the
 *  same amount as every other product in Special Prices — no more, no less. */
export const LAST_PIECE_DISCOUNT_PERCENT = 0;

/** Slugs/names we accept as the canonical "Special Prices" category. */
const SPECIAL_SLUGS = ["special-prices", "special"];

type Db = PrismaClient | Prisma.TransactionClient;

let cachedSpecialId: string | null = null;

/** Resolve the Special Prices category id, memoising only a positive hit (so a
 *  category created after boot is still picked up without a restart). */
async function specialCategoryId(db: Db): Promise<string | null> {
  if (cachedSpecialId) return cachedSpecialId;
  const cat = await db.category.findFirst({
    where: {
      OR: [
        { slug: { in: SPECIAL_SLUGS } },
        { name: { contains: "Special Price", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  cachedSpecialId = cat?.id ?? null;
  return cachedSpecialId;
}

/** The markdown % to apply to a last piece = the Special Prices category's own
 *  flat `discountPct` (so it matches every other product there). NOT memoised —
 *  the admin can change it and it must take effect on the next placement. */
async function lastPieceMarkdownPct(db: Db, specialId: string): Promise<number> {
  const cat = await db.category.findUnique({
    where: { id: specialId },
    select: { discountPct: true },
  });
  const pct = cat?.discountPct ?? LAST_PIECE_DISCOUNT_PERCENT;
  return pct > 0 ? Math.min(100, pct) : 0;
}

/**
 * Reconcile a single product's last-piece special pricing against its current
 * stock. Safe to call after ANY stock mutation — it's a no-op unless the
 * product just crossed the 1-unit boundary. Pass a transaction client when
 * called inside one so the price/category change commits atomically with the
 * stock move.
 */
export async function syncLastPieceSpecial(db: Db, productId: string): Promise<void> {
  const specialId = await specialCategoryId(db);
  if (!specialId) return; // no Special Prices category configured → nothing to do

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      onlinePrice: true,
      mrp: true,
      autoSpecialPrice: true,
      preSpecialOnlinePrice: true,
      categoryId: true,
      category: { select: { excludeFromLastPiece: true } },
      categories: { select: { id: true, excludeFromLastPiece: true } },
      brandRef: { select: { excludeFromLastPiece: true } },
      variants: { select: { stock: true } },
    },
  });
  if (!product) return;

  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
  const isSpecialPrimary = product.categoryId === specialId;
  const taggedSpecial = product.categories.some((c) => c.id === specialId);
  // Opted out if the primary OR any tagged category is excluded. This only
  // blocks NEW auto-placements; a product the system placed earlier still
  // reverts normally when restocked (so nothing gets stranded).
  const excluded =
    (product.category?.excludeFromLastPiece ?? false) ||
    product.categories.some((c) => c.excludeFromLastPiece) ||
    (product.brandRef?.excludeFromLastPiece ?? false);

  // ── Place: exactly one piece left, not already special-priced by us or by an
  //    admin (manual placement = tagged but autoSpecialPrice false), and not in
  //    a category that's opted out of the automation.
  if (totalStock === 1 && !excluded && !product.autoSpecialPrice && !taggedSpecial && !isSpecialPrimary) {
    const base = product.onlinePrice ?? product.mrp;
    const discounted = applyDiscount(base, await lastPieceMarkdownPct(db, specialId));
    await db.product.update({
      where: { id: product.id },
      data: {
        autoSpecialPrice: true,
        preSpecialOnlinePrice: product.onlinePrice, // may be null → restore to null
        onlinePrice: discounted,
        categories: { connect: { id: specialId } },
      },
    });
    return;
  }

  // ── Revert: WE placed it but it's no longer a valid last piece — the stock is
  //    not exactly one (restocked to 2+, OR sold out to 0), OR its category has
  //    since opted out of the automation. Any of these pulls it back out of
  //    Special Prices and restores its price. Manual placements
  //    (autoSpecialPrice false) are intentionally left alone.
  if (product.autoSpecialPrice && (totalStock !== 1 || excluded)) {
    await db.product.update({
      where: { id: product.id },
      data: {
        autoSpecialPrice: false,
        onlinePrice: product.preSpecialOnlinePrice,
        preSpecialOnlinePrice: null,
        categories: { disconnect: { id: specialId } },
      },
    });
  }
}

/** Convenience: reconcile several products (e.g. every line on an order/bill). */
export async function syncLastPieceSpecialMany(
  db: Db,
  productIds: Iterable<string>
): Promise<void> {
  const seen = new Set<string>();
  for (const id of productIds) {
    if (id && !seen.has(id)) {
      seen.add(id);
      await syncLastPieceSpecial(db, id);
    }
  }
}

/**
 * Reconcile every product owning one of the given variant ids. This is the
 * entry point stock-mutation flows use — they typically hold variant ids, not
 * product ids. Null/duplicate ids are ignored. No-op on an empty list.
 */
export async function syncLastPieceForVariants(
  db: Db,
  variantIds: Iterable<string | null | undefined>
): Promise<void> {
  const ids = [...new Set([...variantIds].filter((v): v is string => !!v))];
  if (ids.length === 0) return;
  const rows = await db.productVariant.findMany({
    where: { id: { in: ids } },
    select: { productId: true },
  });
  await syncLastPieceSpecialMany(db, rows.map((r) => r.productId));
}

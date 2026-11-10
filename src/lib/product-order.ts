import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ── Per-scope product ordering ──────────────────────────────────────────────
//
// The GLOBAL shop order is createdAt-desc (main shop; "Move to top" re-stamps
// createdAt=now). To let an admin reorder products inside ONE category or
// collection WITHOUT touching the global order, we keep per-context order rows
// (CategoryProductOrder / CollectionProductOrder) on the SAME epoch-second scale
// as createdAt — so a scope defaults to newest-first (consistent with the shop)
// and a pin is just a product whose position was stamped to "now".

export type Scope =
  | { type: "category"; id: string }
  | { type: "collection"; id: string };

/** Products that belong to a scope (category: primary OR m2m; collection: via its categories). */
export function scopeMembershipWhere(scope: Scope): Prisma.ProductWhereInput {
  if (scope.type === "category") {
    return { OR: [{ categoryId: scope.id }, { categories: { some: { id: scope.id } } }] };
  }
  return {
    OR: [
      { category: { collections: { some: { collectionId: scope.id } } } },
      { categories: { some: { collections: { some: { collectionId: scope.id } } } } },
    ],
  };
}

type OrderRow = {
  id: string;
  sortOrder: number;
  createdAt: Date;
  categoryOrders?: { sortOrder: number }[];
  collectionOrders?: { sortOrder: number }[];
};

// A product's position within a scope. If the admin pinned it (a scope row
// exists) that row's value IS the position. Otherwise the position is the
// product's own freshness — createdAt in EPOCH SECONDS — so a category /
// collection defaults to newest-first, exactly like the main shop, and a
// brand-new product outranks an older pin. "Move to top" writes a scope row =
// ~now (seconds), which the reorder route keeps on the same epoch-second scale.
function effective(scope: Scope, r: OrderRow): number {
  const o =
    scope.type === "category" ? r.categoryOrders?.[0]?.sortOrder : r.collectionOrders?.[0]?.sortOrder;
  return o ?? Math.floor(new Date(r.createdAt).getTime() / 1000);
}

/**
 * Return product ids matching `where`, ordered by their effective order in the
 * scope (scope order ?? global sortOrder, desc; then newest). Callers paginate
 * the returned id list and fetch that page.
 */
export async function scopeOrderedIds(
  scope: Scope,
  where: Prisma.ProductWhereInput
): Promise<string[]> {
  const select =
    scope.type === "category"
      ? {
          id: true,
          sortOrder: true,
          createdAt: true,
          categoryOrders: { where: { categoryId: scope.id }, select: { sortOrder: true } },
        }
      : {
          id: true,
          sortOrder: true,
          createdAt: true,
          collectionOrders: { where: { collectionId: scope.id }, select: { sortOrder: true } },
        };

  const rows = (await db.product.findMany({
    where,
    select: select as Prisma.ProductSelect,
  })) as unknown as OrderRow[];

  rows.sort(
    (a, b) =>
      effective(scope, b) - effective(scope, a) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return rows.map((r) => r.id);
}

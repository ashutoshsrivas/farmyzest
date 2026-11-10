import type { Prisma } from "@prisma/client";

// ── Collection exclusivity ──────────────────────────────────────────────────
//
// A category is "exclusive" when it has a CollectionCategory membership with
// exclusive=true. Products in an exclusive category must appear ONLY under that
// collection's page — hidden from the main shop, category browsing, search,
// homepage, new arrivals, related products, etc.
//
// "Exclusive wins" for multi-category products: if ANY of a product's
// categories (its primary OR any in the m2m set) is exclusive, the whole
// product is hidden from normal storefront listings.
//
// Drop `EXCLUDE_EXCLUSIVE` into the `where` of any public product query to
// enforce this. The admin never uses it (admin shows every product).
export const EXCLUDE_EXCLUSIVE: Prisma.ProductWhereInput = {
  NOT: {
    OR: [
      // Primary category is exclusive.
      { category: { collections: { some: { exclusive: true } } } },
      // Any tagged (m2m) category is exclusive.
      { categories: { some: { collections: { some: { exclusive: true } } } } },
    ],
  },
};

// ── Image gate for the live storefront ──────────────────────────────────────
//
// A product is only shown on the public website when it has at least one image.
// Imageless products stay fully sellable in POS and visible in product
// management, but are hidden from every storefront listing/PDP/search/sitemap
// even when status=ACTIVE and showOnWebsite=true. Drop `HAS_IMAGE` into the
// `where` of any public product query (alongside the showOnWebsite gate).
export const HAS_IMAGE: Prisma.ProductWhereInput = { images: { some: {} } };

// ── Stock gate for the live storefront ──────────────────────────────────────
//
// A product is shown on the public website only when it has at least one
// in-stock variant. Fully out-of-stock products stay sellable in POS and
// visible in product management, but vanish from every storefront
// listing/PDP/search/sitemap — and reappear automatically once restocked.
//
// IMPORTANT: this uses the `variants` relation key. When a query ALSO filters
// variants for another reason (e.g. size/colour facets, which use
// `variants: { some: {...} }`), don't spread IN_STOCK alongside it — the later
// `variants` key would clobber the earlier one. Combine them with `AND` instead:
//   where: { AND: [ { ...baseWhere }, IN_STOCK ] }
export const IN_STOCK: Prisma.ProductWhereInput = {
  variants: { some: { stock: { gt: 0 } } },
};

/**
 * Products that belong to a collection: those whose primary OR m2m category is
 * a member of the collection. Use on the collection page (exclusivity is NOT
 * applied here — exclusive products SHOW under their collection).
 */
export function productsInCollectionWhere(collectionId: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { category: { collections: { some: { collectionId } } } },
      { categories: { some: { collections: { some: { collectionId } } } } },
    ],
  };
}

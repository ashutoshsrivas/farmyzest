import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import AdminPagination from "@/components/admin/Pagination";
import { ProductsTableClient } from "./_components/ProductsTableClient";
import { ProductsFilters } from "./_components/ProductsFilters";
import { productsInCollectionWhere } from "@/lib/collections";
import { scopeOrderedIds, type Scope } from "@/lib/product-order";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 20;

// Sortable columns map to safe Prisma orderBy clauses. Keeping this whitelist
// server-side is the only way to safely accept a `?sort=` from the URL —
// passing user-controlled fields into Prisma orderBy would be a disclosure
// vulnerability.
const SORT_OPTIONS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  name: { name: "asc" },
  "name-desc": { name: "desc" },
  category: { category: { name: "asc" } },
  "category-desc": { category: { name: "desc" } },
  price: { onlinePrice: "asc" },
  "price-desc": { onlinePrice: "desc" },
  status: { status: "asc" },
  "status-desc": { status: "desc" },
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
};

export type AdminProductSortKey = keyof typeof SORT_OPTIONS;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    q?: string;
    category?: string;
    brand?: string;
    status?: string;
    location?: string;
    website?: string;
    images?: string;
    season?: string;
    gender?: string;
    stock?: string;
    collection?: string;
    pageSize?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : DEFAULT_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const hasSort = !!(params.sort && params.sort in SORT_OPTIONS);
  const sortKey: AdminProductSortKey = hasSort
    ? (params.sort as AdminProductSortKey)
    : "newest";
  // Default view: newest first by createdAt. "Move to top" re-stamps a product's
  // createdAt to now (see the reorder route), so it rises to the top like a fresh
  // arrival — and a product added afterwards sorts above it. Within a
  // category/collection scope a manual reorder still applies (see useScopeOrder
  // below); an explicit column/dropdown sort overrides everything.
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = hasSort
    ? [SORT_OPTIONS[sortKey]]
    : [{ createdAt: "desc" }];

  // ── Filters (all URL-driven) ──────────────────────────────────────────────
  const and: Prisma.ProductWhereInput[] = [];
  const q = params.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (params.category) {
    // Primary OR many-to-many membership.
    and.push({
      OR: [
        { category: { slug: params.category } },
        { categories: { some: { slug: params.category } } },
      ],
    });
  }
  if (params.brand) and.push({ brand: params.brand });
  if (params.status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(params.status)) {
    and.push({ status: params.status as Prisma.ProductWhereInput["status"] });
  }
  if (params.location && ["STORE", "GODOWN"].includes(params.location)) {
    and.push({ location: params.location as "STORE" | "GODOWN" });
  }
  if (params.website === "visible") and.push({ showOnWebsite: true });
  if (params.website === "hidden") and.push({ showOnWebsite: false });
  // Image presence. Products with no image are hidden from the live website
  // (enforced storefront-side), so this surfaces what still needs a photo.
  if (params.images === "with") and.push({ images: { some: {} } });
  if (params.images === "without") and.push({ images: { none: {} } });
  if (params.season && ["ALL", "SUMMER", "WINTER"].includes(params.season)) {
    and.push({ season: params.season as Prisma.ProductWhereInput["season"] });
  }
  if (params.gender && ["MEN", "WOMEN", "UNISEX"].includes(params.gender)) {
    and.push({ gender: params.gender as Prisma.ProductWhereInput["gender"] });
  }
  if (params.stock === "in") and.push({ variants: { some: { stock: { gt: 0 } } } });
  if (params.stock === "out") and.push({ NOT: { variants: { some: { stock: { gt: 0 } } } } });
  if (params.stock === "low") {
    // Low = has a variant in stock but at/below its own threshold. Field-to-
    // field comparison isn't expressible in Prisma's where, so resolve the ids.
    const lowRows = await db.$queryRaw<{ productId: string }[]>`
      SELECT DISTINCT "productId" FROM "ProductVariant"
      WHERE stock > 0 AND stock <= "lowStockThreshold"
    `;
    and.push({ id: { in: lowRows.map((r) => r.productId) } });
  }

  // Collection filter (membership via the collection's categories) + reorder
  // scope. A collection filter takes precedence over a category for ordering.
  let collectionId: string | null = null;
  if (params.collection) {
    const col = await db.collection.findUnique({
      where: { slug: params.collection },
      select: { id: true },
    });
    collectionId = col?.id ?? null;
    if (collectionId) and.push(productsInCollectionWhere(collectionId));
  }
  let categoryId: string | null = null;
  if (params.category) {
    const cat = await db.category.findUnique({
      where: { slug: params.category },
      select: { id: true },
    });
    categoryId = cat?.id ?? null;
  }
  const scope: Scope | null = collectionId
    ? { type: "collection", id: collectionId }
    : categoryId
    ? { type: "category", id: categoryId }
    : null;
  // Manual per-scope order only applies to the default (featured) view; an
  // explicit column sort always wins.
  const useScopeOrder = !!scope && !hasSort;

  const where: Prisma.ProductWhereInput = and.length ? { AND: and } : {};

  const include = {
    images: { where: { isPrimary: true }, take: 1 },
    variants: true,
    category: true,
  } as const;

  let products;
  let total: number;
  if (useScopeOrder && scope) {
    // Two-phase: order all matching ids by the scope's manual order, then page.
    const orderedIds = await scopeOrderedIds(scope, where);
    total = orderedIds.length;
    const pageIds = orderedIds.slice(skip, skip + pageSize);
    const fetched = await db.product.findMany({ where: { id: { in: pageIds } }, include });
    const byId = new Map(fetched.map((p) => [p.id, p]));
    products = pageIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  } else {
    [products, total] = await Promise.all([
      db.product.findMany({ where, orderBy, skip, take: pageSize, include }),
      db.product.count({ where }),
    ]);
  }

  const [categories, collections, brandRows] = await Promise.all([
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    db.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    db.product.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
  ]);
  // Real brand names only — drop blanks and numeric junk from imports.
  const brands = brandRows
    .map((b) => b.brand?.trim())
    .filter((b): b is string => !!b && !/^\d+$/.test(b));

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Products</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-nate-grey-500">{total} products</span>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      <ProductsFilters categories={categories} collections={collections} brands={brands} />

      {scope && !hasSort && (
        <p className="-mt-3 mb-4 text-xs text-nate-grey-500">
          Showing this {scope.type}&apos;s own order — <span className="font-medium">Move to top/bottom</span> here
          reorders within this {scope.type} only; the main shop order stays unchanged.
        </p>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-nate-grey-500 mb-4">No products match these filters.</p>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-100 text-nate-grey-700 rounded-lg text-sm font-medium hover:bg-nate-grey-200 transition-colors"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden">
          <ProductsTableClient
            products={products}
            currentSort={sortKey}
            scope={useScopeOrder ? scope : null}
            categories={categories}
          />
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </div>
      )}
    </div>
  );
}

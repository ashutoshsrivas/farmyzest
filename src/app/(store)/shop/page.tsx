export const dynamic = "force-dynamic";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { viewerPrice, viewerListPrice } from "@/lib/pricing";
import { EXCLUDE_EXCLUSIVE, HAS_IMAGE, IN_STOCK } from "@/lib/collections";
import { reclassifyFilterValues, baseSizesFromRaw } from "@/lib/variant-label";
import { scopeOrderedIds } from "@/lib/product-order";
import { expandCategorySlugs } from "@/lib/category-tree";
import { ProductCard } from "@/components/ui/ProductCard";
import { ShopFilters } from "@/components/store/ShopFilters";
import { ShopSort } from "@/components/store/ShopSort";
import { Pagination } from "@/components/store/Pagination";
import Link from "next/link";
import Image from "next/image";

// Per-page: default 45, user-selectable. Bounded to keep query cost sane.
const PER_PAGE_OPTIONS = [24, 45, 90];
const DEFAULT_PER_PAGE = 45;

interface ShopPageProps {
  searchParams: Promise<{ category?: string; collection?: string; season?: string; sort?: string; q?: string; size?: string; page?: string; perPage?: string; color?: string; minPrice?: string; maxPrice?: string; brand?: string }>;
}

export async function generateMetadata({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const title = params.category
    ? `${params.category} — Farmyzest`
    : params.q
    ? `"${params.q}" — Farmyzest`
    : "Shop All — Farmyzest";
  return { title, description: "Plants, seeds, plant care, garden tools and machinery from Nidhi Enterprises." };
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  // Ordering: a single-category browse DEFAULTS to that category's own order —
  // items the admin pinned via "Move to top" first, then everything else
  // newest-first (so a brand-new product auto-surfaces at the top until an
  // admin pins something above it). This is exactly what scopeOrderedIds()
  // returns. Elsewhere (all-shop / multi-category), default to newest. An
  // explicit sort choice (price / newest) always overrides.
  const { category, collection, season, q, size, page: pageParam, perPage: perPageParam, color, minPrice, maxPrice, brand } = params;
  const rawSort = params.sort;
  const sort = rawSort ?? "newest";

  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10));
  const perPage = PER_PAGE_OPTIONS.includes(Number(perPageParam))
    ? Number(perPageParam)
    : DEFAULT_PER_PAGE;
  const skip = (currentPage - 1) * perPage;

  // Parse filter params (all multi-select via comma-separated values).
  const categorySlugs = category ? category.split(",").filter(Boolean) : [];
  const sizeFilter = size ? size.split(",").filter(Boolean) : [];
  const colorFilter = color ? color.split(",").filter(Boolean) : [];
  const brandFilter = brand ? brand.split(",").filter(Boolean) : [];
  const minPriceNum = minPrice ? parseInt(minPrice, 10) : undefined;
  const maxPriceNum = maxPrice ? parseInt(maxPrice, 10) : undefined;

  // Hierarchical browse: a selected category also pulls in every subcategory
  // beneath it, so a product tagged ONLY to a child still shows under the parent.
  const browseSlugs = await expandCategorySlugs(categorySlugs);

  // A product belongs to a category if it's the PRIMARY (category.slug) OR is
  // tagged via the many-to-many. Multi-select: any of the chosen categories
  // (expanded to include their descendants).
  const categoryMatch: Prisma.ProductWhereInput | undefined = browseSlugs.length
    ? {
        OR: [
          { category: { slug: { in: browseSlugs } } },
          { categories: { some: { slug: { in: browseSlugs } } } },
        ],
      }
    : undefined;

  // Size matching that tolerates the messy data: a chosen base size like "M"
  // matches "M", "M-40", "M-42"… (and "40" matches "M-40", "L-40"). Built as an
  // OR of whole-component matches across every selected size.
  const sizeMatch: Prisma.ProductVariantWhereInput[] = sizeFilter.flatMap((t) => {
    const u = t.trim();
    if (!u) return [];
    return [
      { size: { equals: u, mode: "insensitive" as const } },
      { size: { startsWith: `${u}-`, mode: "insensitive" as const } },
      { size: { startsWith: `${u}/`, mode: "insensitive" as const } },
      { size: { endsWith: `-${u}`, mode: "insensitive" as const } },
      { size: { endsWith: `/${u}`, mode: "insensitive" as const } },
    ];
  });

  // Each facet is its OWN element of a top-level AND so the `variants` key never
  // collides (size AND colour can both apply), and IN_STOCK stays independent.
  const baseMatch: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    showOnWebsite: true,
    ...(categoryMatch && { AND: [categoryMatch] }),
    ...(season && { season: season.toUpperCase() as "SUMMER" | "WINTER" }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(minPriceNum && { onlinePrice: { gte: minPriceNum } }),
    ...(maxPriceNum && { onlinePrice: { lte: maxPriceNum } }),
    ...(brandFilter.length > 0 && { brand: { in: brandFilter } }),
    ...HAS_IMAGE,
    ...EXCLUDE_EXCLUSIVE,
  };
  // The matching variant must itself be IN STOCK — otherwise a product with an
  // in-stock L but an out-of-stock M would wrongly show under "size = M".
  const facetConds: Prisma.ProductWhereInput[] = [];
  if (sizeMatch.length)
    facetConds.push({ variants: { some: { stock: { gt: 0 }, OR: sizeMatch } } });
  if (colorFilter.length)
    facetConds.push({ variants: { some: { stock: { gt: 0 }, color: { in: colorFilter, mode: "insensitive" } } } });

  const productWhere: Prisma.ProductWhereInput = { AND: [baseMatch, ...facetConds, IN_STOCK] };

  const totalCount = await db.product.count({ where: productWhere });
  const totalPages = Math.ceil(totalCount / perPage);
  const productInclude = {
    images: { where: { isPrimary: true }, take: 1 },
    category: true,
    brandRef: true,
    // First in-stock variant powers the card's quick-add (Add / Buy hover
    // buttons). Products with no in-stock variant fall back to PDP links.
    variants: {
      where: { stock: { gt: 0 } },
      orderBy: [{ color: "asc" }, { size: "asc" }],
      take: 1,
      select: { id: true, size: true, color: true, stock: true },
    },
  } satisfies Prisma.ProductInclude;

  // A single category uses its own manual order (pinned first, then newest) by
  // DEFAULT and when the shopper explicitly picks "Featured". An explicit
  // price/newest sort skips this and uses the plain orderBy below.
  const useCategoryOrder =
    categorySlugs.length === 1 && (rawSort === undefined || rawSort === "featured");
  let products;
  if (useCategoryOrder) {
    const cat = await db.category.findUnique({ where: { slug: categorySlugs[0] }, select: { id: true } });
    if (cat) {
      const orderedIds = await scopeOrderedIds({ type: "category", id: cat.id }, productWhere);
      const pageIds = orderedIds.slice(skip, skip + perPage);
      const fetched = await db.product.findMany({ where: { id: { in: pageIds } }, include: productInclude });
      const byId = new Map(fetched.map((p) => [p.id, p]));
      products = pageIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    }
  }
  if (!products) {
    products = await db.product.findMany({
      where: productWhere,
      include: productInclude,
      orderBy:
        sort === "price-low"
          ? [{ onlinePrice: "asc" }]
          : sort === "price-high"
          ? [{ onlinePrice: "desc" }]
          : sort === "featured"
          ? [{ sortOrder: "desc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }], // newest (default)
      skip,
      take: perPage,
    });
  }

  const categories = await db.category.findMany({
    // Exclude the system "Uncategorised" holding bucket from storefront browse.
    where: { parentId: null, slug: { not: "uncategorised" } },
    include: { children: true, _count: { select: { products: true } } },
  });

  // Hide empty categories from the shop browse grid + filter bar: keep a
  // top-level category only if it (or one of its children) has at least one
  // product that's actually live on the website — same gate as the listings
  // (ACTIVE + showOnWebsite + has image + not collection-exclusive). It
  // reappears automatically once a live product lands in it.
  const liveProductWhere: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    showOnWebsite: true,
    ...HAS_IMAGE,
    ...EXCLUDE_EXCLUSIVE,
    ...IN_STOCK,
  };
  const nonEmpty = await db.category.findMany({
    where: {
      OR: [
        { products: { some: liveProductWhere } },
        { taggedProducts: { some: liveProductWhere } },
      ],
    },
    select: { id: true },
  });
  const nonEmptyIds = new Set(nonEmpty.map((c) => c.id));
  const visibleCategories = categories.filter(
    (cat) => nonEmptyIds.has(cat.id) || cat.children.some((ch) => nonEmptyIds.has(ch.id)),
  );

  // Get available sizes for the current category filter (primary OR m2m),
  // including subcategories so the facets reflect the full hierarchical result.
  const productCategoryMatch = browseSlugs.length
    ? {
        OR: [
          { category: { slug: { in: browseSlugs } } },
          { categories: { some: { slug: { in: browseSlugs } } } },
        ],
      }
    : {};
  // Only offer sizes/colours that actually have an IN-STOCK variant, so picking
  // one never yields an empty result.
  const sizesWhere = {
    stock: { gt: 0 },
    product: { status: "ACTIVE" as const, ...productCategoryMatch },
  };

  const availableSizes = await db.productVariant.findMany({
    where: { ...sizesWhere, size: { not: null } },
    select: { size: true },
    distinct: ["size"],
  });

  // Get available colors for the current category filter
  const availableColors = await db.productVariant.findMany({
    where: { ...sizesWhere, color: { not: null } },
    select: { color: true },
    distinct: ["color"],
  });

  // Get price range for the current category filter
  const priceStats = await db.product.aggregate({
    where: { status: "ACTIVE", ...productCategoryMatch },
    _min: { onlinePrice: true },
    _max: { onlinePrice: true },
  });

  // Colours: re-bucket so a colour mistakenly stored in `size` (or vice-versa)
  // lands in the right filter. Sizes: collapse to canonical base sizes (M-40 →
  // M) so the options are clean and "M" matches every medium variant.
  const { colors } = reclassifyFilterValues(
    availableSizes.map((v) => v.size),
    availableColors.map((v) => v.color),
  );
  const sizes = baseSizesFromRaw(availableSizes.map((v) => v.size));
  const priceRange = {
    min: Math.floor(priceStats._min.onlinePrice ?? 0),
    max: Math.ceil(priceStats._max.onlinePrice ?? 10000),
  };

  // Available brands for the current context (drop empty + purely-numeric junk
  // brand codes that slipped in from the import).
  const brandRows = await db.product.findMany({
    where: { status: "ACTIVE", showOnWebsite: true, brand: { not: null }, ...productCategoryMatch, ...HAS_IMAGE, ...EXCLUDE_EXCLUSIVE },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
    take: 300,
  });
  const availableBrands = brandRows
    .map((r) => r.brand!)
    .filter((b) => b && b.trim().length > 1 && !/^\d+$/.test(b.trim()));

  // Category list for the in-drawer Category filter (top-level, non-empty).
  const filterCategories = visibleCategories.map((c) => ({ name: c.name, slug: c.slug }));

  // Resellers see wholesale prices in place of retail.
  const session = await auth();
  const role = session?.user?.role;

  const productsData = products.map((p) => {
    const v = p.variants[0];
    // When a category discount marks the product down, strike the pre-discount
    // price; otherwise fall back to any explicit sale price.
    const price = viewerPrice(role, p);
    const listPrice = viewerListPrice(role, p);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      onlinePrice: price,
      comparePrice: listPrice > price ? listPrice : p.salePrice ?? null,
      imageUrl: p.images[0]?.url ?? "",
      categoryName: p.category?.name,
      isNew: new Date().getTime() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
      variantId: v?.id ?? null,
      variantLabel: v ? [v.color, v.size].filter(Boolean).join(" / ") : "",
      stock: v?.stock ?? 0,
    };
  });

  const pageTitle =
    categorySlugs.length === 1
      ? categories.find((c) => c.slug === categorySlugs[0])?.name ?? "All Pieces"
      : categorySlugs.length > 1
      ? "Selected Departments"
      : q
      ? `"${q}"`
      : "All Pieces";

  const currentCategoryName =
    categorySlugs.length === 1
      ? categories.find((c) => c.slug === categorySlugs[0])?.name
      : undefined;

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "featured", label: "Featured" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "price-high", label: "Price: High to Low" },
  ];

  // All active params, carried across sort / per-page / pagination links so a
  // filter is never silently dropped when you change the page or page size.
  const carry: Record<string, string> = {};
  if (category) carry.category = category;
  if (season) carry.season = season;
  if (sort && sort !== "newest") carry.sort = sort;
  if (q) carry.q = q;
  if (size) carry.size = size;
  if (color) carry.color = color;
  if (brand) carry.brand = brand;
  if (minPrice) carry.minPrice = minPrice;
  if (maxPrice) carry.maxPrice = maxPrice;
  if (perPageParam && PER_PAGE_OPTIONS.includes(Number(perPageParam))) carry.perPage = String(perPage);

  return (
    <div className="min-h-screen bg-nado">

      {/* Page header */}
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 pt-12 pb-8">
        <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-grey-500 mb-3">
          Farmyzest
        </p>
        <div className="flex items-end justify-between">
          <h1
            className="font-serif text-grey-900 leading-tight tracking-[-0.01em]"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            {pageTitle}
          </h1>
          <span className="text-xs font-sans text-grey-500 hidden md:block">
            {totalCount} {totalCount === 1 ? "piece" : "pieces"}
          </span>
        </div>
      </div>

      {/* Browse by Department — Bento Grid */}
      {categorySlugs.length === 0 && !q && (
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 pb-10">
          <h2 className="text-[11px] font-sans uppercase tracking-[0.2em] text-grey-500 mb-5">
            Browse by Department
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 gap-3 h-[400px] md:h-[320px]">
            {visibleCategories.map((cat, i) => (
              <Link
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                className={`relative overflow-hidden group ${
                  i === 0
                    ? "col-span-2 row-span-2"
                    : ""
                }`}
              >
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-grey-200" />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <span className="text-white font-serif text-lg md:text-xl leading-tight">
                    {cat.name}
                  </span>
                  <span className="text-white/70 text-[10px] font-sans uppercase tracking-[0.15em] mt-1">
                    {cat._count.products} {cat._count.products === 1 ? "piece" : "pieces"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sticky filter bar */}
      <div className="sticky top-[72px] md:top-20 z-40 bg-white/95 backdrop-blur-sm border-y border-grey-300">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
          <div className="flex items-center gap-0 py-0">

            {/* Filter button — pinned left */}
            <ShopFilters sizes={sizes} colors={colors} brands={availableBrands} categories={filterCategories} priceRange={priceRange} currentCategory={currentCategoryName} currentCategorySlug={categorySlugs[0]} />

            {/* Divider */}
            <div className="w-px h-5 bg-grey-300 shrink-0 mx-1" />

            {/* Category / season pills — only this middle strip scrolls */}
            <div className="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-none">
              {/* All */}
              <Link
                href="/shop"
                className={`shrink-0 px-4 py-5 text-[12px] font-sans font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
                  !category && !season && !collection
                    ? "border-grey-900 text-grey-900"
                    : "border-transparent text-grey-900 hover:text-grey-600"
                }`}
              >
                All
              </Link>

              {/* Category filters */}
              {visibleCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop?category=${cat.slug}`}
                  className={`shrink-0 px-4 py-5 text-[12px] font-sans font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
                    category === cat.slug
                      ? "border-grey-900 text-grey-900"
                      : "border-transparent text-grey-900 hover:text-grey-600"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}

              {/* Season filters */}
              <Link
                href="/shop?season=summer"
                className={`shrink-0 px-4 py-5 text-[12px] font-sans font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
                  season === "summer"
                    ? "border-grey-900 text-grey-900"
                    : "border-transparent text-grey-900 hover:text-grey-600"
                }`}
              >
                Summer
              </Link>
              <Link
                href="/shop?season=winter"
                className={`shrink-0 px-4 py-5 text-[12px] font-sans font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
                  season === "winter"
                    ? "border-grey-900 text-grey-900"
                    : "border-transparent text-grey-900 hover:text-grey-600"
                }`}
              >
                Winter
              </Link>
            </div>

            {/* Sort — pinned right, never scrolls off */}
            <div className="shrink-0 flex items-center pl-2 border-l border-grey-300 ml-1">
              <ShopSort options={sortOptions} current={sort} />
            </div>

          </div>
        </div>
      </div>

      {/* Product grid */}
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-10 md:py-14">
        {productsData.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {productsData.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={product.onlinePrice}
                comparePrice={product.comparePrice}
                imageUrl={product.imageUrl}
                categoryName={product.categoryName}
                isNew={product.isNew}
                productId={product.id}
                variantId={product.variantId}
                variantLabel={product.variantLabel}
                stock={product.stock}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-serif text-grey-700 text-2xl mb-3">Nothing here yet</p>
            <p className="text-sm font-sans font-light text-grey-500 mb-8 max-w-xs">
              We couldn&apos;t find any pieces matching your selection.
            </p>
            <Link
              href="/shop"
              className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-grey-900 border-b border-grey-900 pb-0.5 hover:text-grey-600 hover:border-grey-600 transition-colors"
            >
              Clear Filters
            </Link>
          </div>
        )}
      </div>

      {/* Pagination — `carry` preserves every active filter + the page size. */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        baseUrl="/shop"
        params={carry}
      />
    </div>
  );
}

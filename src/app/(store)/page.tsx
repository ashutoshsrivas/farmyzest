export const dynamic = "force-dynamic";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { EXCLUDE_EXCLUSIVE, HAS_IMAGE, IN_STOCK, productsInCollectionWhere } from "@/lib/collections";
import { viewerPrice, viewerListPrice } from "@/lib/pricing";
import { Hero1 } from "@/components/sections/Hero1";
import { FeaturedCollection1 } from "@/components/sections/FeaturedCollection1";
import { FeaturedProducts1 } from "@/components/sections/FeaturedProducts1";
import { NewArrivals1 } from "@/components/sections/NewArrivals1";
import { CategoryShowcase1 } from "@/components/sections/CategoryShowcase1";
import { BrandStory1 } from "@/components/sections/BrandStory1";
import { ImageBanner1 } from "@/components/sections/ImageBanner1";
import { RichText1 } from "@/components/sections/RichText1";
import { VideoReels1 } from "@/components/sections/VideoReels1";
import type { VideoReelItem } from "@/lib/home-sections";
import { CATEGORY_IMAGES, PLACEHOLDER } from "@/lib/placeholder-images";
import { getSegment, getQuickNav } from "@/lib/segment-server";
import { toDbSegment, type Segment } from "@/lib/segment";
import { COMPANY_ESTABLISHED } from "@/lib/company";
import { getStoreContact } from "@/lib/contact";
import { HeroSplit } from "@/components/home/HeroSplit";
import { Intro } from "@/components/home/Intro";
import { NeedRow } from "@/components/home/NeedRow";
import { CategoryMosaic } from "@/components/home/CategoryMosaic";
import { SowThisMonth } from "@/components/home/SowThisMonth";
import { ProductRail, type RailProduct } from "@/components/home/ProductRail";
import { HeritageBand } from "@/components/home/HeritageBand";
import { FieldNotes } from "@/components/home/FieldNotes";
import { AskUs } from "@/components/home/AskUs";
import { GardenScene, MEADOW } from "@/components/home/garden/GardenScene";
import { getShopNeeds } from "@/lib/shop-needs";
import { readStoreSettings } from "@/lib/store-settings";
import { getHomeContent } from "@/lib/home-content-server";
import type { ProductSpec } from "@/components/ui/ProductCard";

type Cfg = Record<string, unknown>;
const str = (c: Cfg, k: string) => (typeof c[k] === "string" ? (c[k] as string) : undefined);
const num = (c: Cfg, k: string, d: number) => (typeof c[k] === "number" ? (c[k] as number) : d);

const cardInclude = {
  images: { where: { isPrimary: true }, take: 1 },
  category: true,
  brandRef: true,
} satisfies Prisma.ProductInclude;

function toCard(p: Prisma.ProductGetPayload<{ include: typeof cardInclude }>) {
  const price = viewerPrice(undefined, p);
  const listPrice = viewerListPrice(undefined, p);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    onlinePrice: price,
    comparePrice: listPrice > price ? listPrice : p.salePrice ?? null,
    imageUrl: p.images[0]?.url ?? "",
    categoryName: p.category?.name,
    isNew: Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
  };
}

// Products for a Featured/New section, optionally scoped to a collection or
// category, newest-first within the global featured order.
async function fetchProducts(cfg: Cfg, limit: number) {
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    showOnWebsite: true,
    ...HAS_IMAGE,
    ...EXCLUDE_EXCLUSIVE,
    ...IN_STOCK,
  };
  const collectionSlug = str(cfg, "collectionSlug");
  const categorySlug = str(cfg, "categorySlug");
  if (collectionSlug) {
    const col = await db.collection.findUnique({ where: { slug: collectionSlug }, select: { id: true } });
    if (col) Object.assign(where, productsInCollectionWhere(col.id));
  } else if (categorySlug) {
    where.OR = [{ category: { slug: categorySlug } }, { categories: { some: { slug: categorySlug } } }];
  }
  const rows = await db.product.findMany({
    where,
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 24),
    include: cardInclude,
  });
  return rows.map(toCard);
}

export default async function HomePage() {
  const sections = await db.homeSection.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  // The homepage-ranked collection powers Hero / Featured-Collection fallbacks.
  const rankedCollection = await db.collection.findFirst({
    where: { isActive: true, rankOnHome: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        take: 3,
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
      },
    },
  });

  async function renderFeaturedCollection(cfg: Cfg, key: string) {
    // Pick the configured collection, else the homepage-ranked one.
    const slug = str(cfg, "collectionSlug");
    const col = slug
      ? await db.collection.findUnique({
          where: { slug },
          include: {
            products: {
              orderBy: { sortOrder: "asc" },
              take: 3,
              include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
            },
          },
        })
      : rankedCollection;
    const thumbs =
      col?.products.map((cp) => cp.product.images[0]?.url).filter((u): u is string => !!u) ?? [];
    return (
      <FeaturedCollection1
        key={key}
        title={str(cfg, "title") ?? col?.name ?? "Featured Collection"}
        description={
          str(cfg, "description") ??
          "Hand-picked indoor and outdoor plants, healthy and nursery-fresh — delivered to your door."
        }
        ctaText={str(cfg, "ctaText") ?? "Shop Collection"}
        ctaLink={str(cfg, "ctaLink") ?? (col ? `/collections/${col.slug}` : "/shop")}
        mainImage={str(cfg, "mainImage") ?? col?.bannerUrl ?? PLACEHOLDER.featuredMain}
        thumbnails={
          thumbs.length
            ? thumbs
            : [...PLACEHOLDER.featuredThumbs]
        }
      />
    );
  }

  async function renderCategoryShowcase(cfg: Cfg, key: string) {
    const slugs = Array.isArray(cfg.categorySlugs) ? (cfg.categorySlugs as string[]) : null;
    const cats = await db.category.findMany({
      where: slugs && slugs.length ? { slug: { in: slugs } } : { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return (
      <CategoryShowcase1
        key={key}
        categories={cats.map((c) => ({
          name: c.name,
          slug: c.slug,
          imageUrl: c.imageUrl ?? CATEGORY_IMAGES[c.slug] ?? "",
          productCount: c._count.products,
        }))}
      />
    );
  }

  // Render each enabled section in order.
  const nodes: React.ReactNode[] = [];
  for (const s of sections) {
    const cfg = (s.config ?? {}) as Cfg;
    switch (s.type) {
      case "HERO":
        nodes.push(
          <Hero1
            key={s.id}
            backgroundImage={str(cfg, "backgroundImage") ?? rankedCollection?.bannerUrl ?? PLACEHOLDER.hero}
            title={str(cfg, "title") ?? rankedCollection?.name ?? "Grow Something Beautiful"}
            subtitle={str(cfg, "subtitle") ?? "Plants, seeds, plant care, tools and machinery — your one-stop garden & farm store since 1962"}
            ctaText={str(cfg, "ctaText") ?? "Shop Now"}
            ctaLink={str(cfg, "ctaLink") ?? (rankedCollection ? `/collections/${rankedCollection.slug}` : "/shop")}
          />
        );
        break;
      case "VIDEO_REELS": {
        const items = Array.isArray(cfg.items)
          ? (cfg.items as unknown[]).filter(
              (it): it is VideoReelItem =>
                !!it && typeof it === "object" && typeof (it as VideoReelItem).videoUrl === "string"
            )
          : [];
        nodes.push(<VideoReels1 key={s.id} title={str(cfg, "title")} items={items} />);
        break;
      }
      case "FEATURED_COLLECTION":
        nodes.push(await renderFeaturedCollection(cfg, s.id));
        break;
      case "FEATURED_PRODUCTS":
        nodes.push(<FeaturedProducts1 key={s.id} products={await fetchProducts(cfg, num(cfg, "limit", 8))} />);
        break;
      case "NEW_ARRIVALS":
        nodes.push(<NewArrivals1 key={s.id} products={await fetchProducts(cfg, num(cfg, "limit", 4))} />);
        break;
      case "CATEGORY_SHOWCASE":
        nodes.push(await renderCategoryShowcase(cfg, s.id));
        break;
      case "BRAND_STORY":
        nodes.push(<BrandStory1 key={s.id} backgroundImage={str(cfg, "backgroundImage") ?? PLACEHOLDER.story} />);
        break;
      case "IMAGE_BANNER":
        nodes.push(
          <ImageBanner1
            key={s.id}
            imageUrl={str(cfg, "imageUrl")}
            title={str(cfg, "title")}
            subtitle={str(cfg, "subtitle")}
            ctaText={str(cfg, "ctaText")}
            ctaLink={str(cfg, "ctaLink")}
          />
        );
        break;
      case "RICH_TEXT":
        nodes.push(<RichText1 key={s.id} heading={str(cfg, "heading")} body={str(cfg, "body")} />);
        break;
    }
  }

  // Default homepage (Garden/Farm). An admin-built layout above takes over
  // once sections exist in the home-section builder.
  if (sections.length === 0) return <DefaultHome />;

  return <>{nodes}</>;
}


// ── Default Garden/Farm homepage ────────────────────────────────────────────

function readSpecs(v: unknown): ProductSpec[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is ProductSpec => !!x && typeof x === "object" && typeof (x as ProductSpec).label === "string" && (x as ProductSpec).value != null)
    .map((x) => ({ label: x.label, value: String(x.value), unit: x.unit }));
}

/** Products for the rail: the "bestsellers" collection if curated, else newest. Segment-filtered. */
async function railProducts(segment: Segment): Promise<{ products: RailProduct[]; curated: boolean }> {
  const seg = toDbSegment(segment);
  const base: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    showOnWebsite: true,
    ...IN_STOCK,
    ...EXCLUDE_EXCLUSIVE,
    category: { segment: { in: [seg, "BOTH"] } },
  };
  const include = { images: { where: { isPrimary: true }, take: 1 }, category: true } satisfies Prisma.ProductInclude;
  const best = await db.collection.findUnique({ where: { slug: "bestsellers" }, select: { id: true, isActive: true } });
  let rows = best?.isActive
    ? await db.product.findMany({
        where: { AND: [base, productsInCollectionWhere(best.id)] },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        take: 8,
        include,
      })
    : [];
  const curated = rows.length > 0;
  if (!curated) {
    rows = await db.product.findMany({ where: base, orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }], take: 8, include });
  }
  const products = rows.map((p) => {
    const price = viewerPrice(undefined, p);
    const listPrice = viewerListPrice(undefined, p);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price,
      comparePrice: listPrice > price ? listPrice : null,
      imageUrl: p.images[0]?.url ?? "",
      categoryName: p.category?.name,
      isNew: Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
      isDemo: p.isDemo,
      specs: readSpecs(p.specs),
    };
  });
  return { products, curated };
}

async function DefaultHome() {
  const [segment, quickNav, contact, needs, settings, content] = await Promise.all([
    getSegment(),
    getQuickNav(),
    getStoreContact(),
    getShopNeeds(),
    readStoreSettings(),
    getHomeContent(),
  ]);
  // Garden-walk decorations are on unless switched off in admin → Settings.
  const garden = settings.homeGardenTheme !== false;

  const [depts, categoryCount, rail] = await Promise.all([
    db.category.findMany({
      where: { parentId: null, showInMenu: true },
      orderBy: { sortOrder: "asc" },
      select: {
        name: true,
        slug: true,
        segment: true,
        imageUrl: true,
        children: { orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } },
      },
    }),
    db.category.count({ where: { parentId: { not: null } } }),
    railProducts(segment),
  ]);

  const years = new Date().getFullYear() - COMPANY_ESTABLISHED;

  // Section numbers follow what is actually on the page.
  let n = 0;
  const next = () => String(++n).padStart(2, "0");
  const railTitle = rail.curated
    ? segment === "farm" ? content.products.farmTitle : content.products.gardenTitle
    : content.products.newTitle;

  const needNumber = needs.length > 0 ? next() : "";
  const intro = <Intro content={content.intro} departments={depts.length} categories={categoryCount} years={years} />;
  const mosaic = (
    <CategoryMosaic
      number={next()}
      segment={segment}
      title={content.catalogue.title}
      linkLabel={content.catalogue.linkLabel}
      departments={depts.map((d) => ({ ...d, image: d.imageUrl ?? CATEGORY_IMAGES[d.slug] ?? null }))}
    />
  );
  const sow = <SowThisMonth number={next()} content={content.sowing} />;
  const products =
    rail.products.length > 0 ? (
      <ProductRail
        number={next()}
        title={railTitle}
        link={{ label: segment === "farm" ? "Shop Farm" : "Shop Garden", href: `/shop?segment=${segment}` }}
        products={rail.products}
      />
    ) : null;
  const heritage = <HeritageBand number={next()} years={years} content={content.heritage} />;
  const notes = content.notes.items.length ? <FieldNotes number={next()} content={content.notes} /> : null;
  const ask = <AskUs number={next()} contact={contact} content={content.ask} />;

  if (!garden) {
    return (
      <>
        <HeroSplit segment={segment} quickNav={quickNav} panels={content.panels} />
        {needs.length > 0 && (
          <div className="pt-16 md:pt-24">
            <NeedRow number={needNumber} needs={needs} title={content.shopByNeed.title} intro={content.shopByNeed.intro} />
          </div>
        )}
        {intro}
        {mosaic}
        {sow}
        {products}
        {heritage}
        {notes}
        {ask}
      </>
    );
  }

  // Garden landscape: an illustrated scene with layered parallax opens the
  // page; its front meadow rises to become the background of Shop by need,
  // then a hill edge hands over to the regular sections.
  return (
    <>
      <GardenScene content={content.landscape} />
      {/* Overlaps the last stretch of the pinned scene so Shop by need rises
          over the meadow as it fills the screen; green only below the scene. */}
      <div className="garden-after relative z-10 text-bone" style={{ marginTop: "calc(-1 * var(--garden-overlap))" }}>
        <div
          className="garden-after-bg absolute inset-x-0 bottom-12 -z-10 md:bottom-20"
          style={{ background: MEADOW, top: "var(--garden-overlap)" }}
          aria-hidden="true"
        />
        {needs.length > 0 ? <NeedRow number={needNumber} needs={needs} title={content.shopByNeed.title} intro={content.shopByNeed.intro} tone="dark" /> : <div className="h-[42vh]" />}
        {/* Meadow edge: green above a rolling curve, page texture below it. */}
        <svg viewBox="0 0 1600 90" preserveAspectRatio="none" aria-hidden="true" className="-mt-px block h-12 w-full md:h-20">
          <path d="M0 0 L1600 0 L1600 40 C 1340 0, 1060 70, 800 38 S 260 6, 0 46 Z" fill={MEADOW} />
        </svg>
      </div>
      {intro}
      <HeroSplit segment={segment} quickNav={quickNav} panels={content.panels} />
      <div className="pt-16 md:pt-24">{mosaic}</div>
      {sow}
      {products}
      {heritage}
      {notes}
      {ask}
    </>
  );
}

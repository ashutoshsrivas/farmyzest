export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ui/ProductCard";
import { HAS_IMAGE, IN_STOCK, productsInCollectionWhere } from "@/lib/collections";
import { scopeOrderedIds } from "@/lib/product-order";
import { viewerPrice, viewerListPrice } from "@/lib/pricing";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://farmyzest.com";

export async function generateMetadata(
  { params }: CollectionPageProps
): Promise<Metadata> {
  const { slug } = await params;
  const collection = await db.collection.findUnique({
    where: { slug },
    select: { name: true, slug: true, isActive: true, bannerUrl: true, type: true },
  });

  if (!collection || !collection.isActive) {
    return { title: "Collection Not Found", robots: { index: false, follow: false } };
  }

  const title = `${collection.name} — Farmyzest`;
  const description =
    `Shop the ${collection.name} collection at Farmyzest` +
    (collection.type === "SUMMER"
      ? " — light fabrics and warm-weather essentials."
      : collection.type === "WINTER"
      ? " — layered pieces for cold-weather dressing."
      : ".");
  const url = `${BASE_URL}/collections/${collection.slug}`;
  const image = collection.bannerUrl ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Farmyzest",
      title,
      description,
      url,
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: collection.name }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : [],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await db.collection.findUnique({
    where: { slug, isActive: true },
  });
  if (!collection) notFound();

  // Category-based: every product whose primary OR tagged category belongs to
  // this collection. Exclusive products SHOW here (this is their only home).
  // Ordered by THIS collection's manual order (falls back to global sortOrder).
  const baseWhere = {
    status: "ACTIVE" as const,
    showOnWebsite: true,
    ...HAS_IMAGE,
    ...IN_STOCK,
    ...productsInCollectionWhere(collection.id),
  };
  const orderedIds = (
    await scopeOrderedIds({ type: "collection", id: collection.id }, baseWhere)
  ).slice(0, 200);
  const fetched = await db.product.findMany({
    where: { id: { in: orderedIds } },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: true,
      brandRef: true,
      variants: {
        where: { stock: { gt: 0 } },
        orderBy: [{ color: "asc" }, { size: "asc" }],
        take: 1,
        select: { id: true, size: true, color: true, stock: true },
      },
    },
  });
  const byId = new Map(fetched.map((p) => [p.id, p]));
  const products = orderedIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  const productsData = products.map((p) => {
    const v = p.variants[0];
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
      isNew: new Date().getTime() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
      variantId: v?.id ?? null,
      variantLabel: v ? [v.color, v.size].filter(Boolean).join(" / ") : "",
      stock: v?.stock ?? 0,
    };
  });

  return (
    <div className="min-h-screen">
      <div className="bg-nate-grey-800 text-white py-16">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
          <p className="text-white/60 uppercase tracking-wide mb-2">
            {collection.type === "SUMMER" ? "☀" : collection.type === "WINTER" ? "❄" : ""} {collection.type}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif">{collection.name}</h1>
        </div>
      </div>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-12">
        {productsData.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
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
          <div className="text-center py-16">
            <p className="text-nate-grey-500 text-lg">No products in this collection yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";

import { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://farmyzest.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/stores`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const collections = await db.collection.findMany({
    where: { isActive: true },
    select: { slug: true },
  });

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${BASE_URL}/collections/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const products = await db.product.findMany({
    // Same live-storefront gate as the listings: active, shown, has an image,
    // and at least one in-stock variant — so the sitemap never points crawlers
    // at out-of-stock (404'd) product pages.
    where: {
      status: "ACTIVE",
      showOnWebsite: true,
      images: { some: {} },
      variants: { some: { stock: { gt: 0 } } },
    },
    select: { slug: true, updatedAt: true },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/shop/${p.slug}`,
    lastModified: p.updatedAt.toISOString(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const categories = await db.category.findMany({
    where: { products: { some: { status: "ACTIVE", showOnWebsite: true, images: { some: {} } } } },
    select: { slug: true },
  });

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/shop?category=${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...collectionRoutes, ...productRoutes, ...categoryRoutes];
}
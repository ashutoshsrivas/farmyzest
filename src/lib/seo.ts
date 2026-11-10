import { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://farmyzest.com";

interface SeoMetadataOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
  /** ISO date string for article/blog pages */
  publishedAt?: string;
  /** ISO date string for article/blog pages */
  modifiedAt?: string;
  /** Open Graph article author */
  author?: string;
  /** siteName override (defaults to "Farmyzest") */
  siteName?: string;
  /** Twitter handle for card publisher */
  twitterHandle?: string;
  /** Additional keywords for the page */
  keywords?: string[];
}

/**
 * Generates a complete Next.js metadata object with Open Graph support.
 * Use in generateMetadata() or page-level export.
 *
 * @example
 * export const generateMetadata = ({ params }) =>
 *   generateSeoMetadata({
 *     title: "Summer Collection 2026 | Farmyzest",
 *     description: "Shop our curated monsoon planting collection...",
 *     image: "https://cdn.farmyzest.com/summer-og.jpg",
 *     url: "/collections/summer",
 *     type: "website",
 *   });
 */
export function generateSeoMetadata({
  title,
  description,
  image,
  url,
  type = "website",
  publishedAt,
  modifiedAt,
  author,
  siteName = "Farmyzest",
  twitterHandle,
  keywords,
}: SeoMetadataOptions): Metadata {
  const canonicalUrl = url ? `${BASE_URL}${url}` : undefined;
  const ogImage = image ?? `${BASE_URL}/og-default.jpg`;
  const twitterCard = twitterHandle ? "summary_large_image" : "summary";

  return {
    title,
    description,
    keywords: keywords ?? undefined,
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,

    // Open Graph
    openGraph: {
      type: type === "product" ? "website" : type,
      siteName,
      title,
      description,
      images: [
        {
          url: ogImage,
          secureUrl: ogImage.startsWith("https") ? ogImage : undefined,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      url: canonicalUrl,
      ...(publishedAt ? { publishedTime: publishedAt } : {}),
      ...(modifiedAt ? { modifiedTime: modifiedAt } : {}),
      ...(author ? { authors: [author] } : {}),
    },

    // Twitter / X Card
    twitter: {
      card: twitterCard,
      site: twitterHandle ?? "@farmyzest",
      creator: twitterHandle ?? "@farmyzest",
      title,
      description,
      images: [ogImage],
    },

    // Robots — conservative defaults for product/collection pages
    ...(type === "product"
      ? {
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
        }
      : {}),
  };
}

/**
 * Truncates description to a sensible max length for SEO meta tags.
 */
export function truncateDescription(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

/**
 * Builds a product-specific metadata object.
 * Accepts product fields directly from Prisma.
 */
export function productSeoMetadata(
  product: {
    name: string;
    slug: string;
    description?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    category?: { name: string } | null;
    images?: Array<{ url: string }>;
  },
  baseUrl = BASE_URL
): Metadata {
  const title = product.metaTitle ?? product.name;
  const description =
    product.metaDescription ??
    truncateDescription(
      product.description ?? `${product.name} — shop online at Farmyzest.`,
      160
    );
  const image = product.images?.[0]?.url;
  const canonicalUrl = `${baseUrl}/shop/${product.slug}`;

  return generateSeoMetadata({
    title: `${title} | Farmyzest`,
    description,
    image,
    url: canonicalUrl,
    type: "product",
    keywords: [product.category?.name ?? "", product.name].filter(Boolean),
  });
}

export { BASE_URL };
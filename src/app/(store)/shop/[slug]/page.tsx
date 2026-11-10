// src/app/(store)/shop/[slug]/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { viewerPrice, viewerListPrice } from "@/lib/pricing";
import { EXCLUDE_EXCLUSIVE, HAS_IMAGE, IN_STOCK } from "@/lib/collections";
import Link from "next/link";
import { PackageX, ArrowRight } from "lucide-react";
import { PdpInteractive } from "@/components/store/PdpInteractive";
import { ProductCard } from "@/components/ui/ProductCard";
import { AccordionItem } from "@/components/store/AccordionItem";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://farmyzest.com";

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug, status: "ACTIVE", showOnWebsite: true },
    include: {
      category: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  });

  if (!product) {
    // Hidden / removed / out-of-stock products shouldn't be indexed.
    return { title: "Product unavailable · Farmyzest", robots: { index: false, follow: true } };
  }

  const title = product.metaTitle ?? product.name;
  const description =
    product.metaDescription ??
    (product.description
      ? product.description.slice(0, 160)
      : `Shop ${product.name} at Farmyzest — genuine gardening & farm products since 1962.`);
  const image = product.images[0]?.url ?? undefined;

  return {
    title,
    description,
    keywords: [product.category?.name, product.name].filter(Boolean),
    openGraph: {
      type: "website",
      siteName: "Farmyzest",
      title,
      description,
      images: image
        ? [{ url: image, width: 1200, height: 800, alt: product.name }]
        : [],
      url: `${BASE_URL}/shop/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : [],
    },
    alternates: { canonical: `${BASE_URL}/shop/${slug}` },
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

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { slug, status: "ACTIVE", showOnWebsite: true },
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      category: true,
      brandRef: true,
      // Load ALL variants (including out-of-stock) so the PDP can SHOW them
      // greyed-out/crossed rather than hiding them. The "fully out of stock"
      // check below uses the in-stock count, not the raw length.
      variants: true,
      collections: { include: { collection: true } },
    },
  });

  // In-stock variants drive buyability; OOS ones are still shown on the page.
  const inStockVariantCount = product?.variants.filter((v) => v.stock > 0).length ?? 0;

  // Not buyable on the website — missing slug, removed/hidden, no image, or
  // fully out of stock. Instead of a bare 404, show a friendly "unavailable"
  // page that explains why and invites the shopper to keep browsing.
  if (!product || product.images.length === 0 || inStockVariantCount === 0) {
    const existing = await db.product.findUnique({
      where: { slug },
      select: { name: true, status: true, showOnWebsite: true, _count: { select: { images: true } } },
    });
    let reason: "missing" | "removed" | "oos";
    if (!existing) reason = "missing";
    else if (existing.status !== "ACTIVE" || !existing.showOnWebsite || existing._count.images === 0) reason = "removed";
    else reason = "oos"; // live + visible + has image, but every variant is out of stock

    const suggestionsRaw = await db.product.findMany({
      where: { status: "ACTIVE", showOnWebsite: true, ...HAS_IMAGE, ...EXCLUDE_EXCLUSIVE, ...IN_STOCK },
      orderBy: { sortOrder: "desc" },
      take: 5,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
        variants: { where: { stock: { gt: 0 } }, take: 1, select: { id: true, size: true, color: true, stock: true } },
      },
    });
    const suggestions = suggestionsRaw.map((p) => {
      const v = p.variants[0];
      const price = viewerPrice(undefined, p);
      const listPrice = viewerListPrice(undefined, p);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price,
        comparePrice: listPrice > price ? listPrice : p.salePrice ?? null,
        imageUrl: p.images[0]?.url ?? "",
        categoryName: p.category?.name,
        isNew: Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
        variantId: v?.id ?? null,
        variantLabel: v ? [v.color, v.size].filter(Boolean).join(" / ") : "",
        stock: v?.stock ?? 0,
      };
    });

    return <ProductUnavailable name={existing?.name ?? null} reason={reason} suggestions={suggestions} />;
  }

  // Resellers see wholesale prices in place of retail.
  const session = await auth();
  const role = session?.user?.role;

  const relatedProducts = await db.product.findMany({
    where: {
      categoryId: product.categoryId,
      status: "ACTIVE",
      showOnWebsite: true,
      id: { not: product.id },
      ...HAS_IMAGE,
      ...EXCLUDE_EXCLUSIVE,
      ...IN_STOCK,
    },
    take: 5,
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: true,
      variants: {
        where: { stock: { gt: 0 } },
        orderBy: [{ color: "asc" }, { size: "asc" }],
        take: 1,
        select: { id: true, size: true, color: true, stock: true },
      },
    },
  });

  const relatedData = relatedProducts.map((p) => {
    const v = p.variants[0];
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
      isNew:
        Date.now() - new Date(p.createdAt).getTime() <
        7 * 24 * 60 * 60 * 1000,
      variantId: v?.id ?? null,
      variantLabel: v ? [v.color, v.size].filter(Boolean).join(" / ") : "",
      stock: v?.stock ?? 0,
    };
  });

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  // Map "colour name" → gallery image index so the PDP wrapper switches the
  // gallery when a swatch is clicked. Resolution is layered, best → fallback:
  //   1. image.color exactly tags the colour (admin-set, authoritative)
  //   2. image alt text mentions the colour
  //   3. positional: Nth distinct colour → Nth gallery image
  // The positional fallback guarantees the gallery visibly changes on colour
  // click even when images aren't tagged. If a product has fewer images than
  // colours, extra colours map to the last image rather than nothing.
  const colorImageMap: Record<string, number> = {};
  const uniqueColors = [
    ...new Set(product.variants.map((v) => v.color).filter(Boolean) as string[]),
  ];
  uniqueColors.forEach((color, i) => {
    const needle = color.toLowerCase();
    const tagIdx = product.images.findIndex(
      (img) => (img.color ?? "").toLowerCase() === needle
    );
    const altIdx =
      tagIdx >= 0
        ? tagIdx
        : product.images.findIndex((img) =>
            (img.alt ?? "").toLowerCase().includes(needle)
          );
    if (altIdx >= 0) {
      colorImageMap[color] = altIdx;
    } else if (product.images.length > 0) {
      colorImageMap[color] = Math.min(i, product.images.length - 1);
    }
  });

  return (
    <div className="min-h-screen py-8">
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-nate-grey-500 mb-8">
          <Link
            href="/"
            className="hover:text-accent transition-colors"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            href="/shop"
            className="hover:text-accent transition-colors"
          >
            Shop
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link
                href={`/shop?category=${product.category.slug}`}
                className="hover:text-accent transition-colors"
              >
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-nate-grey-700 truncate max-w-[200px]">
            {product.name}
          </span>
        </nav>

        {/* Main product section.
            PdpInteractive is a thin client wrapper that owns the
            cross-component state for "colour swatch → gallery image switch". */}
        <PdpInteractive
          images={product.images.map((img) => ({
            url: img.url,
            alt: img.alt ?? product.name,
          }))}
          product={{
            id: product.id,
            name: product.name,
            description: product.description ?? "",
            mrp: product.mrp,
            onlinePrice: viewerPrice(role, product),
            salePrice: product.salePrice ?? null,
            category: product.category?.name ?? "",
            sku: product.variants[0]?.sku ?? "",
            stock: totalStock,
          }}
          variants={product.variants.map((v) => ({
            id: v.id,
            size: v.size ?? "",
            color: v.color ?? "",
            colorHex: v.colorHex ?? "",
            stock: v.stock,
            price: viewerPrice(role, product, v),
          }))}
          material={product.material ?? undefined}
          care={product.careInstructions ?? undefined}
          colorImageMap={colorImageMap}
          slug={product.slug}
        />

        {/* Product details accordion */}
        <div className="border-t border-nate-grey-200 mb-16">
          <AccordionItem
            title="Description"
            defaultOpen={true}
          >
            <p className="text-nate-grey-600 leading-relaxed">
              {product.description || "No description available for this product."}
            </p>
          </AccordionItem>

          {product.material && (
            <AccordionItem title="Material & Care">
              <div className="space-y-2">
                {product.material && (
                  <p className="text-nate-grey-600">
                    <span className="font-medium text-nate-grey-800">Material: </span>
                    {product.material}
                  </p>
                )}
                {product.careInstructions && (
                  <p className="text-nate-grey-600">
                    <span className="font-medium text-nate-grey-800">Care: </span>
                    {product.careInstructions}
                  </p>
                )}
                {!product.material && product.careInstructions && (
                  <p className="text-nate-grey-600">{product.careInstructions}</p>
                )}
              </div>
            </AccordionItem>
          )}

          <AccordionItem title="Shipping & Exchange">
            <ul className="space-y-2 text-nate-grey-600">
              <li className="flex items-start gap-2">
                <span className="text-nate-grey-400 mt-0.5">—</span>
                Free shipping on all orders
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nate-grey-400 mt-0.5">—</span>
                Standard delivery in 3–5 business days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nate-grey-400 mt-0.5">—</span>
                Easy exchange within 7 days of delivery
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nate-grey-400 mt-0.5">—</span>
                Items must be unworn, unwashed, and with original tags attached
              </li>
            </ul>
          </AccordionItem>
        </div>

        {/* Related products */}
        {relatedData.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {relatedData.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  price={p.onlinePrice}
                  comparePrice={p.comparePrice}
                  imageUrl={p.imageUrl}
                  categoryName={p.categoryName}
                  isNew={p.isNew}
                  productId={p.id}
                  variantId={p.variantId}
                  variantLabel={p.variantLabel}
                  stock={p.stock}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
// Shown in place of the PDP when a product can't be bought on the website
// (removed, hidden, or fully out of stock). Lives inside the storefront layout,
// so it keeps the header/footer, and nudges the shopper to keep browsing.
function ProductUnavailable({
  name,
  reason,
  suggestions,
}: {
  name: string | null;
  reason: "missing" | "removed" | "oos";
  suggestions: {
    id: string;
    slug: string;
    name: string;
    price: number;
    comparePrice: number | null;
    imageUrl: string;
    categoryName?: string;
    isNew: boolean;
    variantId: string | null;
    variantLabel: string;
    stock: number;
  }[];
}) {
  const heading =
    reason === "oos" ? "Currently out of stock" : reason === "removed" ? "No longer available" : "Product not found";
  const label = name ? `“${name}”` : "This product";
  const message =
    reason === "oos"
      ? `${label} is sold out right now. It'll be back on the site once it's restocked.`
      : reason === "removed"
        ? `${label} is no longer available on our store.`
        : "We couldn't find that product — it may have been removed.";

  return (
    <div className="min-h-[60vh] w-full px-6 md:px-12 lg:px-20 xl:px-24 py-16">
      <div className="max-w-xl mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-nate-grey-100 flex items-center justify-center mx-auto mb-5">
          <PackageX className="w-7 h-7 text-nate-grey-400" />
        </div>
        <h1 className="font-serif text-2xl md:text-3xl text-nate-grey-900">{heading}</h1>
        <p className="text-nate-grey-500 mt-3">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 bg-nate-grey-900 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-black transition-colors"
          >
            Continue shopping <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-nate-grey-600 px-6 py-3 rounded-full border border-nate-grey-200 hover:bg-nate-grey-50 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-14 max-w-7xl mx-auto">
          <h2 className="text-[11px] font-sans uppercase tracking-[0.2em] text-nate-grey-500 mb-5 text-center">
            You might also like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {suggestions.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                price={p.price}
                comparePrice={p.comparePrice}
                imageUrl={p.imageUrl}
                categoryName={p.categoryName}
                isNew={p.isNew}
                productId={p.id}
                variantId={p.variantId}
                variantLabel={p.variantLabel}
                stock={p.stock}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

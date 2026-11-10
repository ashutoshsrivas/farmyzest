export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BarcodePrintClient } from "./BarcodePrintClient";

// Server component: gathers every ACTIVE product with at least one variant
// (variants are what carry the actual barcode strings) and hands them to the
// client component that does the picking/quantity/printing.

export default async function BarcodesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { product: productId } = await searchParams;

  const products = await db.product.findMany({
    // Scoped to one product when ?product=<id> is passed (from the Products
    // list "Barcodes" action) — any status; otherwise every ACTIVE product.
    where: productId
      ? { id: productId, variants: { some: { barcode: { not: "" } } } }
      : { status: "ACTIVE", variants: { some: { barcode: { not: "" } } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      mrp: true,
      onlinePrice: true,
      sellingPrice: true,
      variants: {
        where: { barcode: { not: "" } },
        orderBy: [{ color: "asc" }, { size: "asc" }],
        select: {
          id: true,
          sku: true,
          barcode: true,
          size: true,
          color: true,
          stock: true,
          priceOverride: true,
        },
      },
    },
  });

  // Flatten to a single list of "printable rows". Front-end groups them.
  const rows = products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productName: p.name,
      sku: v.sku,
      barcode: v.barcode,
      label: [v.size, v.color].filter(Boolean).join(" / ") || "—",
      stock: v.stock,
      // "Our Price" on the tag — the actual selling price for this variant.
      price: v.priceOverride ?? p.sellingPrice ?? p.onlinePrice ?? p.mrp ?? 0,
    }))
  );

  return <BarcodePrintClient rows={rows} />;
}

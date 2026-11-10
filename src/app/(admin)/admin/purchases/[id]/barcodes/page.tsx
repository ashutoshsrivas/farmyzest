export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { BarcodePrintClient } from "../../../barcodes/BarcodePrintClient";

// Barcode print sheet scoped to a single purchase (supplier bill). Same 2-up
// 50×25mm format, same select/quantity/stock logic as /admin/barcodes — the
// only difference is the row set comes from THIS bill's line items.

export default async function PurchaseBarcodesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { id } = await params;
  const bill = await db.supplierBill.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!bill) notFound();

  // Variant ids in this bill, in line order, de-duplicated (a variant could
  // appear on more than one line — we only want one barcode row for it).
  const orderedVariantIds: string[] = [];
  const seen = new Set<string>();
  for (const it of bill.items) {
    if (it.variantId && !seen.has(it.variantId)) {
      seen.add(it.variantId);
      orderedVariantIds.push(it.variantId);
    }
  }

  const variants = orderedVariantIds.length
    ? await db.productVariant.findMany({
        where: { id: { in: orderedVariantIds }, barcode: { not: "" } },
        select: {
          id: true,
          sku: true,
          barcode: true,
          size: true,
          color: true,
          stock: true,
          priceOverride: true,
          product: { select: { name: true, sellingPrice: true, onlinePrice: true, mrp: true } },
        },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  // Build rows in line order so the print sequence matches the bill, then
  // reverse once (the desired-first product currently lands last).
  const rows = orderedVariantIds
    .map((vid) => byId.get(vid))
    .filter((v): v is NonNullable<typeof v> => !!v)
    .map((v) => ({
      variantId: v.id,
      productName: v.product.name,
      sku: v.sku,
      barcode: v.barcode,
      label: [v.size, v.color].filter(Boolean).join(" / ") || "—",
      stock: v.stock,
      price: v.priceOverride ?? v.product.sellingPrice ?? v.product.onlinePrice ?? v.product.mrp ?? 0,
    }))
    .reverse();

  // Nothing printable: every line either has no variant link or points to a
  // product/variant that was removed from the catalog (e.g. an old test bill
  // wiped by a later inventory overwrite). Say so plainly rather than showing
  // an empty table that looks broken.
  if (rows.length === 0) {
    const orphaned = bill.items.length > 0;
    return (
      <div>
        <Link
          href={`/admin/purchases/${bill.id}`}
          className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to purchase
        </Link>
        <div className="bg-white rounded-xl p-8 text-center max-w-lg">
          <h1 className="text-xl font-serif text-nate-grey-800 mb-2">
            No barcodes to print
          </h1>
          <p className="text-sm text-nate-grey-500">
            {orphaned
              ? `None of the ${bill.items.length} item${bill.items.length === 1 ? "" : "s"} on purchase ${bill.billNumber} link to a current product. The products on this bill were removed from the catalogue (e.g. by a later inventory overwrite), so there are no live barcodes to print.`
              : `Purchase ${bill.billNumber} has no items.`}
          </p>
          <p className="text-xs text-nate-grey-400 mt-3">
            New purchases created against the current catalogue will print barcodes here normally.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BarcodePrintClient
      rows={rows}
      title="Print Barcodes"
      subtitle={`Purchase ${bill.billNumber} · ${rows.length} product${rows.length === 1 ? "" : "s"}`}
      backHref={`/admin/purchases/${bill.id}`}
      backLabel="Back to purchase"
    />
  );
}

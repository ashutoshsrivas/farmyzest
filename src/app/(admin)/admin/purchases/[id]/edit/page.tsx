export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NewBillForm } from "../../_components/NewBillForm";

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditSupplierBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { id } = await params;

  const [bill, suppliers, categories, taxSlabs] = await Promise.all([
    db.supplierBill.findUnique({
      where: { id },
      include: { items: true },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, email: true, address: true, gstin: true },
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.taxSlab.findMany({
      where: { isActive: true },
      orderBy: { percentage: "asc" },
      select: { id: true, name: true, percentage: true },
    }),
  ]);

  if (!bill) notFound();

  // Resolve each line's variant code (SKU/barcode) so the form shows it.
  const variantIds = bill.items.map((i) => i.variantId).filter((v): v is string => !!v);
  const variants = variantIds.length
    ? await db.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, barcode: true } })
    : [];
  const codeByVariant = new Map(variants.map((v) => [v.id, v.sku || v.barcode]));

  const initial = {
    id: bill.id,
    supplierId: bill.supplierId,
    refBillNo: bill.refBillNo ?? "",
    date: ymd(bill.date),
    shippingDate: ymd(bill.shippingDate),
    dueDate: ymd(bill.dueDate),
    paymentTerm: bill.paymentTerm ?? "",
    reverseCharge: bill.reverseCharge,
    taxType: bill.taxType ?? "Default",
    // The stored flatDiscount is the absolute ₹ amount; present it as absolute
    // on edit (we don't keep the original "X%" input).
    flatDiscount: String(bill.flatDiscount ?? 0),
    flatDiscountIsPct: false,
    notes: bill.notes ?? "",
    terms: bill.termsAndConditions ?? "",
    updateCostPrice: true,
    items: bill.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      sku: (it.variantId ? codeByVariant.get(it.variantId) : "") ?? "",
      description: it.description,
      hsnCode: it.hsnCode ?? "",
      unit: it.unit ?? "PCS",
      quantity: String(it.quantity),
      freeQuantity: String(it.freeQuantity),
      unitCost: String(it.unitCost),
      mrp: it.mrp != null ? String(it.mrp) : "",
      sellingPrice: it.sellingPrice != null ? String(it.sellingPrice) : "",
      discount1Pct: String(it.discount1Pct),
      discount2Pct: String(it.discount2Pct),
      taxPercent: it.taxPercent != null ? String(it.taxPercent) : "",
      stock: null,
    })),
  };

  return (
    <NewBillForm suppliers={suppliers} categories={categories} taxSlabs={taxSlabs} initial={initial} />
  );
}

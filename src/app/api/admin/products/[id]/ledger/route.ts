export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Product ledger: every supplier bill this product was purchased on (stock IN)
// and every order it was sold on (stock OUT). Read-only, admin-only. Matched by
// productId — the durable link kept on both SupplierBillItem and OrderItem.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [purchaseItems, saleItems] = await Promise.all([
    db.supplierBillItem.findMany({
      where: { productId: id },
      orderBy: { bill: { date: "desc" } },
      select: {
        id: true,
        description: true,
        quantity: true,
        freeQuantity: true,
        unitCost: true,
        amount: true,
        bill: {
          select: {
            id: true,
            billNumber: true,
            refBillNo: true,
            date: true,
            supplier: { select: { name: true } },
          },
        },
      },
    }),
    db.orderItem.findMany({
      where: { productId: id },
      orderBy: { order: { createdAt: "desc" } },
      select: {
        id: true,
        variantLabel: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
        order: {
          select: {
            id: true,
            source: true,
            status: true,
            posOrderNum: true,
            createdAt: true,
            billingName: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const purchases = purchaseItems.map((it) => ({
    itemId: it.id,
    billId: it.bill.id,
    billNumber: it.bill.billNumber,
    refBillNo: it.bill.refBillNo,
    supplier: it.bill.supplier?.name ?? "—",
    date: it.bill.date.toISOString(),
    description: it.description,
    quantity: it.quantity,
    freeQuantity: it.freeQuantity,
    unitCost: it.unitCost,
    amount: it.amount,
  }));

  const sales = saleItems
    // Defensive: skip any orphaned item whose order was hard-deleted.
    .filter((it) => it.order)
    .map((it) => ({
      itemId: it.id,
      orderId: it.order.id,
      orderNumber: it.order.posOrderNum ?? it.order.id.slice(-8).toUpperCase(),
      source: it.order.source, // ONLINE | POS
      status: it.order.status,
      date: it.order.createdAt.toISOString(),
      customer: it.order.user?.name ?? it.order.billingName ?? (it.order.source === "POS" ? "Walk-in" : "Guest"),
      variantLabel: it.variantLabel,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    }));

  // Summary. Sold quantity counts only orders that weren't cancelled/returned
  // (those didn't actually leave stock), but we still list them below.
  const purchasedQty = purchases.reduce((s, p) => s + p.quantity + p.freeQuantity, 0);
  const purchaseValue = purchases.reduce((s, p) => s + p.amount, 0);
  const soldQty = sales
    .filter((s) => s.status !== "CANCELLED" && s.status !== "RETURNED")
    .reduce((s, x) => s + x.quantity, 0);
  const salesValue = sales
    .filter((s) => s.status !== "CANCELLED" && s.status !== "RETURNED")
    .reduce((s, x) => s + x.totalPrice, 0);

  return NextResponse.json({
    purchases,
    sales,
    summary: {
      purchasedQty,
      purchaseValue,
      soldQty,
      salesValue,
      purchaseBills: new Set(purchases.map((p) => p.billId)).size,
      salesOrders: new Set(sales.map((s) => s.orderId)).size,
    },
  });
}

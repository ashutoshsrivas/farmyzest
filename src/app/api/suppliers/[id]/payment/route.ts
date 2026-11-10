import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { amount, method, reference } = body;

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    }

    // Find oldest unpaid bill for this supplier
    const bill = await db.supplierBill.findFirst({
      where: { supplierId: id, status: { not: "PAID" } },
      orderBy: { date: "asc" },
    });

    if (!bill) {
      // Reduce supplier balance directly
      const supplier = await db.supplier.update({
        where: { id },
        data: { balance: { decrement: parseFloat(amount) } },
      });
      return NextResponse.json({ success: true, supplier });
    }

    // Record payment against the bill
    const payment = await db.supplierPayment.create({
      data: {
        billId: bill.id,
        amount: parseFloat(amount),
        method,
        reference: reference || null,
      },
    });

    // Recalculate bill status
    const allPayments = await db.supplierPayment.aggregate({
      where: { billId: bill.id },
      _sum: { amount: true },
    });

    const paid = allPayments._sum.amount || 0;
    let newStatus: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
    if (paid >= bill.total) newStatus = "PAID";
    else if (paid > 0) newStatus = "PARTIAL";

    await db.supplierBill.update({
      where: { id: bill.id },
      data: { status: newStatus },
    });

    // Update supplier balance
    const supplier = await db.supplier.update({
      where: { id },
      data: { balance: { decrement: parseFloat(amount) } },
    });

    return NextResponse.json({ success: true, payment, supplier });
  } catch (error) {
    console.error("POST /api/suppliers/[id]/payment error:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
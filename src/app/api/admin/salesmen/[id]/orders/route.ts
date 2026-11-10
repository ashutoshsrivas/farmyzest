import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Orders a salesman "brought" — billed by them OR attended by them — with an
// optional date range. Powers the orders modal on the salesman detail page.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");

  const createdAt: Prisma.DateTimeFilter = {};
  if (fromStr) {
    const d = new Date(fromStr);
    if (!isNaN(d.getTime())) createdAt.gte = d;
  }
  if (toStr) {
    const d = new Date(toStr);
    if (!isNaN(d.getTime())) {
      // Inclusive end-of-day for a yyyy-mm-dd value.
      d.setHours(23, 59, 59, 999);
      createdAt.lte = d;
    }
  }

  const orders = await db.order.findMany({
    where: {
      // Billed by / attended by this salesman, OR carries an article-wise line
      // assigned to them.
      OR: [{ salesmanId: id }, { attendedById: id }, { items: { some: { salesmanId: id } } }],
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      posOrderNum: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      source: true,
      salesmanId: true,
      attendedById: true,
      billingName: true,
      billingPhone: true,
      items: { select: { productName: true, quantity: true, totalPrice: true, salesmanId: true } },
    },
  });

  const rows = orders.map((o) => {
    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0);
    const first = o.items[0];
    const productSummary = first
      ? `${first.productName}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}`
      : "—";
    // Value actually attributed to THIS salesman on this order: their own
    // article-wise lines, plus the rest of the bill if they billed/attended it.
    const isBillEarner = (o.attendedById ?? o.salesmanId) === id;
    const reassignedToOthers = o.items.reduce(
      (s, it) => s + (it.salesmanId && it.salesmanId !== (o.attendedById ?? o.salesmanId) ? it.totalPrice : 0),
      0
    );
    const myLines = o.items.reduce((s, it) => s + (it.salesmanId === id ? it.totalPrice : 0), 0);
    const attributed = isBillEarner ? o.total - reassignedToOthers : myLines;
    const role = o.attendedById === id ? "Attended" : o.salesmanId === id ? "Billed" : "Article";
    return {
      id: o.id,
      orderNumber: o.posOrderNum ?? o.id.slice(-8).toUpperCase(),
      total: o.total,
      attributed: Math.round(attributed * 100) / 100,
      status: o.status,
      paymentStatus: o.paymentStatus,
      date: o.createdAt.toISOString(),
      source: o.source,
      role,
      customer: o.billingName || "Walk-in",
      customerPhone: o.billingPhone || "",
      productSummary,
      itemCount,
    };
  });

  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  return NextResponse.json({ orders: rows, count: rows.length, totalAmount });
}

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderSearchOr } from "@/lib/order-search";
import { quickRangeWindow, isQuickRange } from "@/lib/order-range";

// GET /api/admin/orders/export?status=...&source=...&from=...&to=...
//
// Returns a CSV with one row per order. Filters mirror the /admin/orders
// page so the exported file matches what the admin sees on screen.
//
// We cap at 20k rows for safety; if the store ever needs more we can paginate
// the export or stream chunked. For now an SMB-sized catalog fits comfortably.

const MAX_ROWS = 20_000;

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  // RFC 4180: quote if the field contains comma, double-quote, or newline.
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const source = sp.get("source");
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  const searchOr = orderSearchOr(sp.get("q") ?? "");

  // Period matches the Orders page: custom from/to overrides the quick range,
  // which defaults to Today.
  const dateRange: { gte?: Date; lt?: Date } = {};
  if (fromStr || toStr) {
    if (fromStr) {
      const d = new Date(fromStr);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        dateRange.gte = d;
      }
    }
    if (toStr) {
      const d = new Date(toStr);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 1);
        dateRange.lt = d;
      }
    }
  } else {
    const rangeParam = sp.get("range");
    const w = quickRangeWindow(isQuickRange(rangeParam) ? rangeParam : "today");
    if (w.gte) dateRange.gte = w.gte;
    if (w.lt) dateRange.lt = w.lt;
  }

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as Prisma.OrderWhereInput["status"] } : {}),
    ...(source ? { source: source as Prisma.OrderWhereInput["source"] } : {}),
    ...(dateRange.gte || dateRange.lt ? { createdAt: dateRange } : {}),
    ...(searchOr.length ? { OR: searchOr } : {}),
  };

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: {
      user: { select: { name: true, email: true, phone: true } },
      salesman: { select: { name: true } },
      items: { select: { quantity: true } },
    },
  });

  const headers = [
    "Order ID",
    "POS Order #",
    "Source",
    "Status",
    "Payment Method",
    "Payment Status",
    "Customer",
    "Phone",
    "Email",
    "Salesman",
    "Items",
    "Subtotal",
    "Tax",
    "Discount",
    "Total",
    "Created At",
  ];

  const rows = orders.map((o) => {
    // Real customer: linked account, else the contact captured on the order.
    const customerName =
      o.user?.name ?? o.billingName ?? (o.source === "POS" ? "Walk-in" : "Guest");
    const phone = o.user?.phone ?? o.billingPhone ?? "";
    const email = o.user?.email ?? "";
    const salesman = o.source === "POS" ? o.salesman?.name ?? "" : "";
    const itemsCount = o.items.reduce((sum, it) => sum + it.quantity, 0);
    return [
      o.id,
      o.posOrderNum ?? "",
      o.source,
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      customerName,
      phone,
      email,
      salesman,
      itemsCount,
      o.subtotal,
      o.taxAmount,
      o.discount,
      o.total,
      o.createdAt.toISOString(),
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv = [headers.map(csvEscape).join(","), ...rows].join("\r\n") + "\r\n";

  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `orders-${dateTag}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

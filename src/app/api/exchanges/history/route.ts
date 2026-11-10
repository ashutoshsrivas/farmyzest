import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/exchanges/history?phone=...
//
// Powers the phone-based exchange flow (POS + Admin). Given a customer's phone
// number, returns every item they've ever purchased with the EXACT price paid
// at the time (OrderItem.unitPrice — already net of any discount), so the
// counter can compute what to refund / collect on a swap.
//
// Matching: we compare the trailing 10 digits of the stored billingPhone (POS /
// guest checkout) OR the registered user's phone, so "+91 98…", "098…" and
// "98…" all resolve to the same customer.

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

function digits10(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.slice(-10);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phoneRaw = req.nextUrl.searchParams.get("phone") ?? "";
  const phone = digits10(phoneRaw);
  if (phone.length < 6) {
    return NextResponse.json(
      { error: "Enter at least 6 digits of the phone number" },
      { status: 400 }
    );
  }

  // contains on the trailing digits. billingPhone may carry spaces / +91, so
  // we can't index-match exactly — contains on the last 10 digits is the
  // pragmatic lookup. (Volume here is tiny: one customer's history.)
  const orders = await db.order.findMany({
    where: {
      OR: [
        { billingPhone: { contains: phone } },
        { user: { is: { phone: { contains: phone } } } },
      ],
      status: { not: "CANCELLED" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      posOrderNum: true,
      source: true,
      createdAt: true,
      billingName: true,
      billingPhone: true,
      user: { select: { name: true, phone: true } },
      items: {
        select: {
          id: true,
          productId: true,
          variantId: true,
          productName: true,
          variantLabel: true,
          sku: true,
          imageUrl: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  // Best-guess customer name from the most recent order.
  const customerName =
    orders.find((o) => o.billingName)?.billingName ??
    orders.find((o) => o.user?.name)?.user?.name ??
    "";

  const result = orders.map((o) => ({
    orderId: o.id,
    orderNumber: o.posOrderNum ?? o.id.slice(0, 8).toUpperCase(),
    source: o.source,
    date: o.createdAt.toISOString(),
    // Only items tied to a real variant can be exchanged (cash/custom lines
    // have no stock to move back).
    items: o.items
      .filter((it) => !!it.variantId)
      .map((it) => ({
        orderItemId: it.id,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        variantLabel: it.variantLabel,
        sku: it.sku,
        imageUrl: it.imageUrl,
        quantity: it.quantity,
        unitPrice: it.unitPrice, // actual price paid
      })),
  }));

  return NextResponse.json({ customerName, phone, orders: result });
}

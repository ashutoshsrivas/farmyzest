import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Customers POST a return request once an order is DELIVERED. Admin then
// approves/rejects from the admin panel (separate flow — not built here).
// We record a Return row with status=REQUESTED + the chosen refund amount
// (defaults to the full order total). No stock or refund movement happens
// at request time — admin actions do those later.

const returnRequestSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(5, "Tell us a bit more — at least 5 characters").max(2000),
  notes: z.string().trim().max(2000).optional(),
  // Optional partial-refund hint. If omitted we refund the whole order.
  refundAmount: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = returnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { orderId, reason, notes, refundAmount } = parsed.data;

  try {
    const order = await db.order.findFirst({
      where: { id: orderId, userId: session.user.id },
      select: { id: true, status: true, total: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "DELIVERED") {
      return NextResponse.json(
        { error: `Only delivered orders are returnable (current status: ${order.status}).` },
        { status: 409 }
      );
    }

    const existing = await db.return.findFirst({ where: { orderId } });
    if (existing) {
      return NextResponse.json(
        { error: "A return request already exists for this order." },
        { status: 409 }
      );
    }

    const refund = Math.min(refundAmount ?? order.total, order.total);

    const created = await db.return.create({
      data: {
        orderId,
        userId: session.user.id,
        reason,
        notes,
        refundAmount: refund,
        // status / refundStatus use schema defaults (REQUESTED + PENDING)
      },
      select: { id: true, status: true, refundAmount: true },
    });

    return NextResponse.json({ success: true, return: created }, { status: 201 });
  } catch (err) {
    console.error("[returns] failed:", err);
    return NextResponse.json({ error: "Failed to file return" }, { status: 500 });
  }
}

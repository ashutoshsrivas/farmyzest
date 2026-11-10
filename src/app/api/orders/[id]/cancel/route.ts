import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncLastPieceForVariants } from "@/lib/last-piece";

// POST /api/orders/[id]/cancel
//
// Lets a customer cancel their own order while it's still PENDING or
// PROCESSING. Anything later (SHIPPED, OUT_FOR_DELIVERY, DELIVERED) has to
// go through the returns flow instead.
//
// Wrapped in a transaction so we restore stock atomically with the status
// change — if stock restoration fails the cancel is rolled back, never
// leaving the system in a "cancelled but stock not restored" half-state.

const CANCELLABLE = new Set(["PENDING", "PROCESSING"]);

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Order id required" }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      // Scope to the caller's own orders — admins go through a different
      // admin-side cancel endpoint (not yet built).
      const order = await tx.order.findFirst({
        where: { id, userId: session.user.id },
        include: { items: true },
      });
      if (!order) return { status: 404 as const };

      if (!CANCELLABLE.has(order.status)) {
        return { status: 409 as const, reason: order.status };
      }

      // Restore variant stock only if this order currently holds it. A
      // PENDING/PROCESSING order never deducted stock (deduction happens at
      // fulfilment), so there's nothing to return. POS "cash items" have no
      // variantId; those are skipped regardless.
      if (order.stockDeducted) {
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await syncLastPieceForVariants(tx, order.items.map((i) => i.variantId));
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", stockDeducted: false },
      });
      return { status: 200 as const, order: updated };
    });

    if (result.status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (result.status === 409) {
      return NextResponse.json(
        {
          error: `Order can't be cancelled — current status is ${result.reason}. ` +
            `Use the returns flow for shipped/delivered orders.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, order: result.order });
  } catch (err) {
    console.error("[orders/cancel]", err);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}

import type { Prisma, OrderStatus } from "@prisma/client";
import { deductsStock, isConfirmedSaleStatus } from "@/lib/order-status";
import { ensureLoyaltyConfig, pointsForAmount } from "@/lib/loyalty";
import { syncLastPieceForVariants } from "@/lib/last-piece";

// SERVER-ONLY. Kept separate from lib/order-status.ts (which is imported by
// client components like OrderStatusControl) because this pulls in Prisma /
// last-piece — importing it into a client bundle would break the build.

const CANCEL_RETURN = new Set<OrderStatus>(["CANCELLED", "RETURNED"]);

// The order shape the transition needs. Structural so both the admin PATCH
// route and the courier webhook can pass their own selects.
export type TransitionOrder = {
  id: string;
  status: OrderStatus;
  stockDeducted: boolean;
  loyaltyAwarded: boolean;
  userId: string | null;
  subtotal: number;
  posOrderNum: string | null;
  paidCash: number;
  paidCredit: number;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  items: { variantId: string | null; quantity: number }[];
};

/**
 * Apply an order status transition inside a transaction — the SINGLE place that
 * moves stock, awards/claws back loyalty, and stamps the tracking timeline.
 * Used by the admin status control AND the courier status-sync webhook so both
 * paths behave identically. Returns the updated order row.
 */
export async function applyOrderStatusTransition(
  tx: Prisma.TransactionClient,
  order: TransitionOrder,
  nextStatus: OrderStatus,
  opts: { collectBalance?: boolean } = {}
) {
  const now = new Date();
  const willRelease = CANCEL_RETURN.has(nextStatus);

  // Stock reconciliation (idempotent via stockDeducted).
  const wasDeducted = order.stockDeducted;
  const willDeduct = deductsStock(nextStatus);
  let nextDeducted = wasDeducted;
  let stockTouched = false;
  if (willDeduct && !wasDeducted) {
    for (const it of order.items) {
      if (!it.variantId) continue;
      await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { decrement: it.quantity } } });
    }
    nextDeducted = true;
    stockTouched = true;
  } else if (!willDeduct && wasDeducted) {
    for (const it of order.items) {
      if (!it.variantId) continue;
      await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
    }
    nextDeducted = false;
    stockTouched = true;
  }
  if (stockTouched) {
    await syncLastPieceForVariants(tx, order.items.map((it) => it.variantId));
  }

  // Loyalty: credit once the order becomes a CONFIRMED sale (Processing →
  // Delivered), not only on Delivered — many orders are fulfilled in-store and
  // never marked "Delivered", so waiting for it meant points effectively never
  // accrued. Idempotent via loyaltyAwarded. Claw back on cancel/return.
  let nextAwarded = order.loyaltyAwarded;
  if (order.userId) {
    const cfg = await ensureLoyaltyConfig(tx);
    const earnable = pointsForAmount(order.subtotal, cfg);
    const ref = order.posOrderNum ?? order.id.slice(-8).toUpperCase();
    if (isConfirmedSaleStatus(nextStatus) && !order.loyaltyAwarded && earnable > 0) {
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: earnable } } });
      await tx.loyaltyTransaction.create({
        data: { userId: order.userId, orderId: order.id, type: "EARN", points: earnable, description: `Points earned on order ${ref}` },
      });
      nextAwarded = true;
    } else if (willRelease && order.loyaltyAwarded && earnable > 0) {
      const u = await tx.user.findUnique({ where: { id: order.userId }, select: { loyaltyPoints: true } });
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: Math.max(0, (u?.loyaltyPoints ?? 0) - earnable) } });
      await tx.loyaltyTransaction.create({
        data: { userId: order.userId, orderId: order.id, type: "REDEEM", points: -earnable, description: `Order ${ref} reversed (${nextStatus.toLowerCase()})` },
      });
      nextAwarded = false;
    }
  }

  // Partial-payment balance settled on delivery (or explicit collect).
  const wantsCollect = opts.collectBalance === true || nextStatus === "DELIVERED";
  const settleBalance = wantsCollect && order.paidCredit > 0 && !willRelease;

  // Tracking timeline — each stamp set once, never cleared on a backward move.
  const stamps: Partial<Record<"confirmedAt" | "shippedAt" | "outForDeliveryAt" | "deliveredAt", Date>> = {};
  const reached = (...s: OrderStatus[]) => s.includes(nextStatus);
  if (!order.confirmedAt && reached("PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED")) stamps.confirmedAt = now;
  if (!order.shippedAt && reached("SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED")) stamps.shippedAt = now;
  if (!order.outForDeliveryAt && reached("OUT_FOR_DELIVERY", "DELIVERED")) stamps.outForDeliveryAt = now;
  if (!order.deliveredAt && reached("DELIVERED")) stamps.deliveredAt = now;

  return tx.order.update({
    where: { id: order.id },
    data: {
      status: nextStatus,
      loyaltyAwarded: nextAwarded,
      stockDeducted: nextDeducted,
      ...stamps,
      ...(settleBalance ? { paidCash: order.paidCash + order.paidCredit, paidCredit: 0, paymentStatus: "PAID" as const } : {}),
    },
  });
}

// Single source of truth for how order status relates to inventory AND billing.
//
// Business rule: an order deducts stock AND has a valid bill/invoice ONLY while
// it is in one of the four ACTIVE statuses — Processing, Shipped, Out for
// delivery, or Delivered. In any other status (Pending, Cancelled, Returned)
// the items are NOT taken out of inventory and no bill is generated for it.
//
// The Order.stockDeducted flag records whether the deduction is currently
// applied, so toggling status back and forth never double-counts.

// Type-only import — erased at build, so this stays safe to import from client
// components that also pull in the constants/helpers below.
import type { Prisma } from "@prisma/client";

export const ALL_ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type OrderStatusValue = (typeof ALL_ORDER_STATUSES)[number];

// Statuses at which the order's items are considered OUT of inventory.
// Stock and the bill are coupled — these same statuses are the "billable" ones.
export const STOCK_DEDUCTING_STATUSES: readonly OrderStatusValue[] = [
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/** True when an order in this status should have its stock deducted. */
export function deductsStock(status: string): boolean {
  return (STOCK_DEDUCTING_STATUSES as readonly string[]).includes(status);
}

/**
 * True when an order in this status has a valid bill/invoice. Same four statuses
 * as stock deduction — a Pending/Cancelled/Returned order has no bill.
 */
export function hasBill(status: string): boolean {
  return deductsStock(status);
}

/**
 * True when an order at this status counts as a CONFIRMED sale — i.e. staff has
 * accepted it and moved it into a billable status. Same four statuses as stock
 * deduction. An online order can become a sale two ways: money is captured, OR
 * it's confirmed to one of these statuses (e.g. a COD order marked Processing).
 */
export function isConfirmedSaleStatus(status: string): boolean {
  return deductsStock(status);
}

/**
 * Prisma `NOT` fragment for sales/revenue aggregates: excludes ONLINE orders
 * that are NOT yet a sale — still PENDING/FAILED on payment AND not confirmed
 * to a billable status. POS orders (always paid at the counter) are never
 * excluded. Shared by the Orders page and the Dashboard so both report the same
 * "Online Sales" number. Combine with a `status: { notIn: [CANCELLED,RETURNED] }`
 * guard on the surrounding where, as both callers already do.
 */
export function onlineNotASale(): Prisma.OrderWhereInput {
  return {
    source: "ONLINE",
    paymentStatus: { notIn: ["PAID", "PARTIAL"] },
    status: { notIn: [...STOCK_DEDUCTING_STATUSES] },
  };
}

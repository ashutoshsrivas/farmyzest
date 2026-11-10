import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import { notifyOrderStatus, type OrderStatusTrigger } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/wallet";
import { applyOrderStatusTransition } from "@/lib/order-transition";
import { syncLastPieceForVariants } from "@/lib/last-piece";
import { autoBookShipment } from "@/lib/quikshipx";
import { sendOrderBill } from "@/lib/bill-delivery";

// Status changes that trigger a WhatsApp update to the customer.
const NOTIFY_TRIGGERS: Partial<Record<OrderStatus, OrderStatusTrigger>> = {
  SHIPPED: "SHIPPED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
};

// PATCH /api/admin/orders/[id]  — admin order status transitions.
//
// Stock semantics (deduct-on-fulfilment): an order's items leave inventory the
// first time it enters a fulfilment status (Shipped / Out-for-delivery /
// Delivered), and return to the shelf when it leaves those (back to
// Pending/Processing, or into Cancelled/Returned). Pending & Processing never
// hold stock. The Order.stockDeducted flag makes this idempotent, so toggling
// status back and forth never double-counts. POS bills are born DELIVERED.

const STATUS_VALUES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

const patchSchema = z
  .object({
    status: z.enum(STATUS_VALUES).optional(),
    // Mark a partial order's balance (paidCredit) as collected on delivery.
    collectBalance: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.collectBalance, "Nothing to update");

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid status" },
      { status: 400 }
    );
  }
  try {
    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) return { notFound: true as const };

      // Status may be omitted (a balance-collect-only action) — keep the current.
      const nextStatus = (parsed.data.status ?? order.status) as OrderStatus;

      // All stock / loyalty / timeline effects live in the shared transition
      // helper so the admin control and the courier webhook stay in lockstep.
      const result = await applyOrderStatusTransition(tx, order, nextStatus, {
        collectBalance: parsed.data.collectBalance === true,
      });

      // Auto-book the courier the moment an ONLINE order first enters fulfilment
      // (covers COD orders that never hit the PayU callback). Fire-and-forget.
      if (
        order.source === "ONLINE" &&
        nextStatus === "PROCESSING" &&
        order.status !== "PROCESSING"
      ) {
        void autoBookShipment(order.id);
      }
      return {
        order: result,
        changed: order.status !== nextStatus,
        email: result.billingEmail || "",
        phone: result.shippingPhone || result.billingPhone || "",
        name: result.shippingName || result.billingName || "there",
        itemCount: order.items.length,
        orderNumber: result.posOrderNum ?? result.id.slice(-8).toUpperCase(),
      };
    });

    if ("notFound" in updated) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Email the customer on a real shipped/out-for-delivery/delivered change.
    const trigger = NOTIFY_TRIGGERS[updated.order.status as OrderStatus];
    if (trigger && updated.changed && updated.email) {
      notifyOrderStatus({
        email: updated.email,
        trigger,
        order: {
          orderId: updated.order.id,
          orderNumber: updated.orderNumber,
          customerName: updated.name,
          customerEmail: updated.email,
          customerPhone: updated.phone || undefined,
          total: updated.order.total,
          itemCount: updated.itemCount,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, order: updated.order });
  } catch (err) {
    console.error("[admin orders PATCH]", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

// ── PUT /api/admin/orders/[id] — full bill edit ──────────────────────────────
// Re-rings the whole order: swap line items, change quantities / prices / line
// discounts, set a bill-level discount, and correct the customer. Stock is
// reconciled by DIFFING the new quantities against what the order previously
// held (per variant), so we only deduct/return the delta — never double-count.
//
// Guard rails: an order that's already CANCELLED/RETURNED, or that has any
// exchanges against it, is locked (editing would corrupt restock / exchange
// accounting). The day's POS session totals are intentionally left untouched.

const editItemSchema = z.object({
  variantId: z.string().nullable().optional(),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  // Gross (pre-discount) list unit price; server recomputes the net.
  unitPrice: z.number().nonnegative().optional(),
  name: z.string().optional(),
  discountType: z.enum(["PERCENT", "FIXED"]).optional(),
  discountValue: z.number().nonnegative().optional(),
  // Optional per-line (article-wise) salesman.
  salesmanId: z.string().optional().nullable(),
});

const editOrderSchema = z.object({
  items: z.array(editItemSchema).min(1, "At least one item is required"),
  billDiscountType: z.enum(["PERCENT", "FIXED"]).optional(),
  billDiscountValue: z.number().nonnegative().optional(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  // POS bill-edit extras (omitted by the admin EditOrderPanel → unchanged).
  customerEmail: z.string().trim().max(160).optional().nullable(),
  additionalCharges: z.number().nonnegative().optional(),
  roundOff: z.boolean().optional(),
  orderType: z.enum(["WALK_IN", "DELIVERY"]).optional(),
  salesmanId: z.string().optional().nullable(),
  attendedById: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  payments: z
    .object({
      cash: z.number().nonnegative().optional(),
      upi: z.number().nonnegative().optional(),
      card: z.number().nonnegative().optional(),
      credit: z.number().nonnegative().optional(),
    })
    .optional(),
});

const PUT_ROLES = new Set(["ADMIN", "POS_STAFF"]);

/** ₹ off `base` for a discount; never exceeds base, so nets stay ≥ 0. */
function discountAmount(
  type: "PERCENT" | "FIXED" | undefined,
  value: number | undefined,
  base: number
): number {
  if (!value || value <= 0) return 0;
  const raw = type === "FIXED" ? value : (base * value) / 100;
  return Math.min(base, Math.max(0, raw));
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !PUT_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = editOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order edit" },
      { status: 400 }
    );
  }
  const {
    items, billDiscountType, billDiscountValue, customerName, customerPhone,
    customerEmail, additionalCharges = 0, roundOff = false, orderType,
    salesmanId, attendedById, notes, payments,
  } = parsed.data;

  try {
    // Load the order with its current items + an exchange count for the lock.
    const existing = await db.order.findUnique({
      where: { id },
      include: { items: true, _count: { select: { exchanges: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (existing.status === "CANCELLED" || existing.status === "RETURNED") {
      return NextResponse.json(
        { error: "Cancelled / returned orders can't be edited." },
        { status: 409 }
      );
    }
    if (existing._count.exchanges > 0) {
      return NextResponse.json(
        { error: "This order has exchanges and can't be edited." },
        { status: 409 }
      );
    }

    // Resolve catalog variants referenced by the new line-up.
    const catalogItems = items.filter((i) => i.variantId && i.productId !== "cash");
    const variantIds = [...new Set(catalogItems.map((i) => i.variantId!))];
    const variants = variantIds.length
      ? await db.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { include: { taxSlab: true } } },
        })
      : [];
    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: "One or more variants not found" }, { status: 400 });
    }
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Stock reconciliation: how much each variant's quantity CHANGES vs before.
    const oldQty = new Map<string, number>();
    for (const it of existing.items) {
      if (it.variantId) oldQty.set(it.variantId, (oldQty.get(it.variantId) ?? 0) + it.quantity);
    }
    const newQty = new Map<string, number>();
    for (const it of catalogItems) {
      newQty.set(it.variantId!, (newQty.get(it.variantId!) ?? 0) + it.quantity);
    }

    // Only NET-new demand needs free stock (the old qty is already deducted).
    // Skipped entirely for orders that don't currently hold stock (Pending /
    // Processing online orders) — editing them touches no inventory.
    const insufficient: { name: string; available: number; needed: number }[] = [];
    for (const vid of new Set([...oldQty.keys(), ...newQty.keys()])) {
      const delta = (newQty.get(vid) ?? 0) - (oldQty.get(vid) ?? 0);
      if (existing.stockDeducted && delta > 0) {
        const v = variantMap.get(vid);
        const available = v?.stock ?? 0;
        if (delta > available) {
          insufficient.push({
            name: v ? `${v.product.name}${v.size ? ` (${v.size})` : ""}` : vid,
            available,
            needed: delta,
          });
        }
      }
    }
    if (insufficient.length > 0) {
      return NextResponse.json({ error: "Insufficient stock", insufficient }, { status: 409 });
    }

    const normalizedPhone = normalizePhone(customerPhone);
    const billingPhone =
      normalizedPhone.length === 10 ? normalizedPhone : customerPhone?.trim() || null;

    await db.$transaction(async (tx) => {
      const orderItemsData: {
        productId: string;
        variantId: string | null;
        productName: string;
        variantLabel: string | null;
        sku: string | null;
        barcode: string | null;
        imageUrl: string | null;
        quantity: number;
        unitPrice: number;
        taxPercent: number | null;
        totalPrice: number;
        listPrice: number | null;
        discount: number;
        discountType: string | null;
        discountValue: number | null;
        costPriceSnapshot: number | null;
        salesmanId: string | null;
      }[] = [];

      // Valid salesman ids so a stray per-line salesmanId can't break the FK.
      const validSalesmanIds = new Set(
        (await tx.salesman.findMany({ select: { id: true } })).map((s) => s.id)
      );

      let subtotal = 0;
      let lineDiscountTotal = 0;

      for (const item of items) {
        const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
        const listUnit =
          item.unitPrice ??
          (variant
            ? variant.priceOverride ?? variant.product.onlinePrice ?? variant.product.mrp
            : 0);
        const taxPercent = variant?.product.taxSlab?.percentage ?? 0;

        const gross = listUnit * item.quantity;
        const dAmt = discountAmount(item.discountType, item.discountValue, gross);
        const net = gross - dAmt;
        const netUnit = item.quantity > 0 ? net / item.quantity : 0;

        subtotal += gross;
        lineDiscountTotal += dAmt;

        let imageUrl: string | null = null;
        if (variant) {
          const primaryImage = await tx.productImage.findFirst({
            where: { productId: variant.productId, isPrimary: true },
            select: { url: true },
          });
          imageUrl = primaryImage?.url ?? null;
        }

        const variantLabel = variant
          ? [variant.color, variant.size].filter(Boolean).join(" / ") || null
          : null;

        orderItemsData.push({
          productId: variant ? variant.productId : "cash",
          variantId: variant ? variant.id : null,
          productName: variant ? variant.product.name : item.name?.trim() || "Custom item",
          variantLabel,
          sku: variant?.sku ?? null,
          barcode: variant?.barcode ?? null,
          imageUrl,
          quantity: item.quantity,
          unitPrice: netUnit,
          taxPercent: taxPercent > 0 ? taxPercent : null,
          totalPrice: net,
          listPrice: listUnit,
          discount: dAmt,
          // Preserve original discount type + effective value (percentage stays
          // percentage) so re-editing this bill keeps each line's discount form.
          discountType: dAmt > 0 ? (item.discountType ?? "FIXED") : null,
          discountValue:
            dAmt > 0
              ? item.discountType === "PERCENT"
                ? gross > 0
                  ? (dAmt / gross) * 100
                  : 0
                : dAmt
              : null,
          costPriceSnapshot: variant?.product.costPrice ?? null,
          salesmanId:
            item.salesmanId && item.salesmanId !== salesmanId && validSalesmanIds.has(item.salesmanId)
              ? item.salesmanId
              : null,
        });
      }

      const netSubtotal = subtotal - lineDiscountTotal;
      const billDisc = discountAmount(billDiscountType, billDiscountValue, netSubtotal);
      const totalDiscount = lineDiscountTotal + billDisc;
      // Goods − discounts + ad-hoc charges, then optional round-to-rupee.
      const preRound = Math.max(0, subtotal - totalDiscount) + additionalCharges;
      const roundDelta = roundOff ? Math.round(preRound) - preRound : 0;
      const total = Math.max(0, preRound + roundDelta);

      // Split tender (POS edit). When omitted, the existing breakdown is kept.
      const pay = payments
        ? {
            paidCash: payments.cash ?? 0,
            paidUpi: payments.upi ?? 0,
            paidCard: payments.card ?? 0,
            paidCredit: payments.credit ?? 0,
            paymentMethod: (([payments.cash, payments.upi, payments.card, payments.credit].filter((v) => (v ?? 0) > 0).length > 1
              ? "SPLIT"
              : (payments.cash ?? 0) > 0 ? "CASH" : (payments.upi ?? 0) > 0 ? "UPI" : (payments.card ?? 0) > 0 ? "GATEWAY" : (payments.credit ?? 0) > 0 ? "CREDIT" : "CASH") as
              | "SPLIT" | "CASH" | "UPI" | "GATEWAY" | "CREDIT"),
            paymentStatus: ((payments.credit ?? 0) > 0 ? "PARTIAL" : "PAID") as "PARTIAL" | "PAID",
          }
        : {};

      // Swap the line items. createdAt is never touched → date/time preserved.
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.update({
        where: { id },
        data: {
          subtotal,
          taxAmount: 0,
          discount: totalDiscount,
          additionalCharges,
          roundOff: roundDelta,
          total,
          billingName: customerName?.trim() || null,
          billingPhone,
          ...(customerEmail !== undefined ? { billingEmail: customerEmail?.trim()?.toLowerCase() || null } : {}),
          ...(orderType ? { orderType } : {}),
          ...(salesmanId ? { salesmanId } : {}),
          ...(attendedById !== undefined ? { attendedById: attendedById || null } : {}),
          ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
          ...pay,
          items: { create: orderItemsData },
        },
      });

      // Apply the stock delta per variant — but only for orders that currently
      // hold stock (fulfilment / POS). Pending & Processing online orders don't
      // touch inventory until they ship.
      if (existing.stockDeducted) {
        for (const vid of new Set([...oldQty.keys(), ...newQty.keys()])) {
          const delta = (newQty.get(vid) ?? 0) - (oldQty.get(vid) ?? 0);
          if (delta > 0) {
            await tx.productVariant.update({
              where: { id: vid },
              data: { stock: { decrement: delta } },
            });
          } else if (delta < 0) {
            await tx.productVariant.update({
              where: { id: vid },
              data: { stock: { increment: -delta } },
            });
          }
        }
      }
    });

    // Re-deliver the corrected bill to the customer (WhatsApp document + email
    // attachment). Fire-and-forget and fully fail-soft — it only sends when the
    // order actually carries a phone / email, and never blocks the edit.
    void sendOrderBill(id).catch((err) =>
      console.error("[Bill] edit re-delivery failed:", err)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin orders PUT]", err);
    return NextResponse.json({ error: "Failed to edit order" }, { status: 500 });
  }
}

// DELETE /api/admin/orders/[id] — permanently remove a bill/order.
//
// For erroneous or duplicate bills. It reverses the order's side effects so the
// books stay correct, then hard-deletes the row (OrderItems cascade):
//   • restores stock if the order currently holds it (deduct-on-fulfilment);
//   • refunds any wallet redemption / claws back any wallet credit it created;
//   • reverses recorded loyalty points, then drops those ledger rows;
//   • detaches product reviews and removes any shipment record.
// It is BLOCKED when the order has exchanges or returns recorded — those carry
// their own money movements and must be undone first.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          _count: { select: { exchanges: true, returns: true } },
        },
      });
      if (!order) return { status: 404 as const };
      if (order._count.exchanges > 0 || order._count.returns > 0) {
        return { status: 409 as const };
      }

      // 1) Put stock back if this order is currently holding it.
      if (order.stockDeducted) {
        for (const it of order.items) {
          if (!it.variantId) continue; // POS cash items have no variant
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.quantity } },
          });
        }
        await syncLastPieceForVariants(tx, order.items.map((i) => i.variantId));
      }

      // 2) Reverse any loyalty points recorded against this order, then drop the
      //    ledger rows. `points` is signed (EARN +, REDEEM −), so the net is the
      //    exact amount to undo from the customer's balance.
      if (order.userId) {
        const loyalty = await tx.loyaltyTransaction.findMany({ where: { orderId: id } });
        const net = loyalty.reduce((s, t) => s + t.points, 0);
        if (net !== 0) {
          const u = await tx.user.findUnique({
            where: { id: order.userId },
            select: { loyaltyPoints: true },
          });
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: Math.max(0, (u?.loyaltyPoints ?? 0) - net) },
          });
        }
        if (loyalty.length) await tx.loyaltyTransaction.deleteMany({ where: { orderId: id } });
      }

      // 3) Reverse wallet movements (refund a redemption / claw back a credit),
      //    then drop the rows so nothing references the deleted order.
      const walletTxns = await tx.walletTransaction.findMany({ where: { orderId: id } });
      if (walletTxns.length) {
        const netByWallet = new Map<string, number>();
        for (const t of walletTxns) {
          netByWallet.set(t.walletId, (netByWallet.get(t.walletId) ?? 0) + t.amount);
        }
        for (const [walletId, net] of netByWallet) {
          if (net === 0) continue;
          const w = await tx.wallet.findUnique({ where: { id: walletId }, select: { balance: true } });
          await tx.wallet.update({
            where: { id: walletId },
            data: { balance: Math.max(0, (w?.balance ?? 0) - net) },
          });
        }
        await tx.walletTransaction.deleteMany({ where: { orderId: id } });
      }

      // 4) Detach non-cascading references, then delete the order.
      await tx.review.updateMany({ where: { orderId: id }, data: { orderId: null } });
      await tx.shipment.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
      return { status: 200 as const };
    });

    if (result.status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (result.status === 409) {
      return NextResponse.json(
        { error: "This bill has exchanges or returns recorded. Reverse those first, then delete." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin orders DELETE]", err);
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 });
  }
}

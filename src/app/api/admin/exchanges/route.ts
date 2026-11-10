import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateWallet, creditWallet, normalizePhone } from "@/lib/wallet";
import { syncLastPieceForVariants } from "@/lib/last-piece";

// Roles allowed to key exchanges: store admins and POS counter staff.
const EXCHANGE_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// POST /api/admin/exchanges
//
// Admin-keyed swap. Works for both ONLINE and POS orders. For each line:
//   - We *increment* the returned variant's stock by `returnedQuantity`
//     (item is back on the shelf).
//   - If a replacement variant is provided, we *decrement* that variant's
//     stock by `replacementQuantity` (and validate it's in stock first).
//   - The price difference is the replacement's price minus the returned's
//     price, summed across all lines.
//
// All stock movements + the Exchange + ExchangeItem rows are written in a
// single transaction so a partial failure can't leave inventory in a torn
// state. Reservations (concurrent sales) are not held — admin should run this
// during low-traffic windows. For high-throughput stores, switch to row-level
// locking with `forUpdate`.

const lineSchema = z
  .object({
    returnedOrderItemId: z.string().optional().nullable(),
    returnedVariantId: z.string().min(1, "returnedVariantId is required"),
    returnedQuantity: z.number().int().positive(),
    returnedUnitPrice: z.number().nonnegative(),

    replacementVariantId: z.string().optional().nullable(),
    // NOTE: the client sends `null` (not undefined) for a pure return. Zod v4's
    // `.optional()` accepts undefined but REJECTS null — without `.nullable()`
    // every return/refund 400s with "expected number, received null".
    replacementQuantity: z.number().int().nonnegative().optional().nullable(),
    replacementUnitPrice: z.number().nonnegative().optional().nullable(),
  })
  .refine(
    (l) =>
      !l.replacementVariantId ||
      (l.replacementQuantity != null && l.replacementQuantity > 0),
    "replacementQuantity must be > 0 when replacementVariantId is set"
  );

const bodySchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(lineSchema).min(1, "At least one line is required"),
  // How to settle money owed to the customer when the returned value exceeds
  // the replacement value (or on a pure return). "CASH" = handed over at the
  // counter (no wallet write). "WALLET" = parked as store credit, which
  // requires a phone to key the wallet.
  refundMethod: z.enum(["CASH", "WALLET"]).optional(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !EXCHANGE_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { orderId, reason, notes, items, refundMethod, customerPhone } = parsed.data;

  // Pre-flight: order exists, all replacement variants have stock.
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, source: true, billingPhone: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Phone used to key the store-credit wallet. Prefer the phone the client
  // sent (the one the exchange was looked up by); fall back to the order's.
  const walletPhone = normalizePhone(customerPhone || order.billingPhone);
  if (refundMethod === "WALLET" && walletPhone.length < 10) {
    return NextResponse.json(
      { error: "A 10-digit customer phone is required to credit the wallet." },
      { status: 400 }
    );
  }

  const replacementIds = items
    .map((i) => i.replacementVariantId)
    .filter((id): id is string => !!id);
  const replacementVariants =
    replacementIds.length > 0
      ? await db.productVariant.findMany({
          where: { id: { in: replacementIds } },
          select: { id: true, sku: true, stock: true, product: { select: { name: true } } },
        })
      : [];
  const repMap = new Map(replacementVariants.map((v) => [v.id, v]));

  const insufficient: { variantId: string; sku: string; available: number; requested: number }[] = [];
  for (const it of items) {
    if (!it.replacementVariantId) continue;
    const v = repMap.get(it.replacementVariantId);
    if (!v) {
      return NextResponse.json(
        { error: `Replacement variant not found: ${it.replacementVariantId}` },
        { status: 400 }
      );
    }
    if (v.stock < (it.replacementQuantity ?? 0)) {
      insufficient.push({
        variantId: v.id,
        sku: v.sku,
        available: v.stock,
        requested: it.replacementQuantity ?? 0,
      });
    }
  }
  if (insufficient.length) {
    return NextResponse.json(
      { error: "Insufficient replacement stock", insufficient },
      { status: 409 }
    );
  }

  try {
    const result = await db.$transaction(async (tx) => {
      let priceDifference = 0;
      const itemsToCreate: {
        returnedOrderItemId: string | null;
        returnedVariantId: string;
        returnedQuantity: number;
        returnedUnitPrice: number;
        replacementVariantId: string | null;
        replacementQuantity: number;
        replacementUnitPrice: number | null;
      }[] = [];

      for (const line of items) {
        // Restore returned stock.
        await tx.productVariant.update({
          where: { id: line.returnedVariantId },
          data: { stock: { increment: line.returnedQuantity } },
        });

        // Deduct replacement stock (if any).
        if (line.replacementVariantId) {
          await tx.productVariant.update({
            where: { id: line.replacementVariantId },
            data: { stock: { decrement: line.replacementQuantity ?? 0 } },
          });
        }

        const replacementTotal =
          (line.replacementUnitPrice ?? 0) * (line.replacementQuantity ?? 0);
        const returnedTotal = line.returnedUnitPrice * line.returnedQuantity;
        priceDifference += replacementTotal - returnedTotal;

        itemsToCreate.push({
          returnedOrderItemId: line.returnedOrderItemId ?? null,
          returnedVariantId: line.returnedVariantId,
          returnedQuantity: line.returnedQuantity,
          returnedUnitPrice: line.returnedUnitPrice,
          replacementVariantId: line.replacementVariantId ?? null,
          replacementQuantity: line.replacementQuantity ?? 0,
          replacementUnitPrice: line.replacementUnitPrice ?? null,
        });
      }

      // A return restocks (may lift off last-piece) and a replacement deducts
      // (may hit last-piece) — reconcile both sides.
      await syncLastPieceForVariants(
        tx,
        items.flatMap((l) => [l.returnedVariantId, l.replacementVariantId ?? null])
      );

      // Amount owed back to the customer (returned value exceeds replacement
      // value, or a pure return). Only this can go to the wallet; a positive
      // priceDifference means the customer pays more at the counter.
      const owed = Math.max(0, -priceDifference);
      const walletCreditAmount =
        refundMethod === "WALLET" && owed > 0 ? owed : 0;

      const exchange = await tx.exchange.create({
        data: {
          orderId,
          reason,
          notes,
          priceDifference,
          refundMethod: owed > 0 ? refundMethod ?? "CASH" : null,
          walletCreditAmount,
          status: "COMPLETED",
          completedAt: new Date(),
          processedByUserId: session.user.id,
          items: { create: itemsToCreate },
        },
        include: { items: true },
      });

      // Park the owed amount as store credit when requested.
      let walletBalance: number | null = null;
      if (walletCreditAmount > 0) {
        const wallet = await getOrCreateWallet(tx, walletPhone);
        if (!wallet) {
          // Should be unreachable (we validated phone length above), but guard
          // so we never silently swallow the customer's money.
          throw new Error("WALLET_PHONE_UNUSABLE");
        }
        walletBalance = await creditWallet(
          tx,
          wallet.id,
          walletCreditAmount,
          "EXCHANGE_CREDIT",
          `Exchange credit · order ${orderId}`,
          { orderId, exchangeId: exchange.id }
        );
      }

      return { exchange, walletCreditAmount, walletBalance };
    });

    return NextResponse.json(
      {
        success: true,
        exchange: result.exchange,
        walletCreditAmount: result.walletCreditAmount,
        walletBalance: result.walletBalance,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[exchanges]", err);
    return NextResponse.json({ error: "Failed to record exchange" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orderId = req.nextUrl.searchParams.get("orderId");
  const exchanges = await db.exchange.findMany({
    where: orderId ? { orderId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { items: true },
  });
  return NextResponse.json({ exchanges });
}

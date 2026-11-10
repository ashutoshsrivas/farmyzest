import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyResponseHash, payuCallbackBase } from "@/lib/payu";
import { notifyOnlineOrderPlaced } from "@/lib/whatsapp";
import { sendOrderBill } from "@/lib/bill-delivery";
import { syncLastPieceForVariants } from "@/lib/last-piece";
import { autoBookShipment } from "@/lib/quikshipx";

// POST /api/payu/callback
//
// Single surl/furl endpoint PayU redirects the browser to (form-urlencoded)
// after a payment attempt. We:
//   1. Verify the response hash with our SALT — an unsigned/forged post is
//      ignored (no order change).
//   2. Cross-check the amount against the stored order.
//   3. On success → mark the order PAID and record PayU's payment id.
//      On failure → mark it FAILED, restore stock, and cancel the order so the
//      inventory it was holding goes back on the shelf.
// Then we 303-redirect the shopper to a friendly success/failure page.
//
// This is a browser-driven redirect (not the only source of truth) — for
// belt-and-braces you can later add PayU's server-to-server webhook + a
// reconciliation cron for abandoned attempts (neither surl nor furl fires when
// the shopper closes the tab mid-payment).

export const dynamic = "force-dynamic";

function redirect(path: string) {
  return NextResponse.redirect(new URL(path, payuCallbackBase()), 303);
}

export async function POST(req: NextRequest) {
  let fields: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) fields[k] = typeof v === "string" ? v : "";
  } catch {
    return redirect("/checkout/failed?reason=bad_response");
  }

  const txnid = fields.txnid ?? "";
  const status = (fields.status ?? "").toLowerCase();

  // 1. Authenticity — recompute the hash with our salt.
  if (!verifyResponseHash(fields)) {
    console.error("[payu] hash mismatch for txnid", txnid);
    return redirect(`/checkout/failed?reason=verify&order=${encodeURIComponent(txnid)}`);
  }

  const order = await db.order.findUnique({
    where: { id: txnid },
    select: {
      id: true,
      total: true,
      paidCredit: true,
      status: true,
      paymentStatus: true,
      stockDeducted: true,
      billingEmail: true,
      billingName: true,
      billingPhone: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });
  if (!order) {
    console.error("[payu] no order for txnid", txnid);
    return redirect("/checkout/failed?reason=no_order");
  }

  // Idempotency — PayU (or a refresh) can hit this twice.
  if (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIAL")
    return redirect(`/checkout/success?order=${order.id}`);
  if (order.status === "CANCELLED") return redirect(`/checkout/failed?order=${order.id}`);

  // For a partial order, only the advance (total − balance-on-delivery) is
  // charged now; for a normal order, the full total.
  const balanceDue = order.paidCredit ?? 0;
  const expectedNow = Math.max(0, order.total - balanceDue);
  const paidOk =
    status === "success" &&
    Math.abs(Number(fields.amount) - expectedNow) < 0.5; // amounts must match (±50p rounding)

  if (paidOk) {
    // Payment captured → order enters PROCESSING, which is a stock-deducting /
    // billable status. Deduct inventory HERE (the admin PATCH route only fires
    // for admin-driven transitions; a prepaid order jumps straight to
    // PROCESSING from this callback and would otherwise bill without ever
    // leaving stock). Idempotent via stockDeducted + the PAID/PARTIAL guard
    // above, so a duplicated callback can't double-deduct.
    await db.$transaction(async (tx) => {
      if (!order.stockDeducted) {
        for (const it of order.items) {
          if (!it.variantId) continue; // safety: skip any variant-less line
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { decrement: it.quantity } },
          });
        }
        await syncLastPieceForVariants(tx, order.items.map((it) => it.variantId));
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          // Partial: advance captured, balance still due on delivery → PARTIAL.
          paymentStatus: balanceDue > 0 ? "PARTIAL" : "PAID",
          status: "PROCESSING",
          stockDeducted: true,
          // Payment cleared → order confirmed (first milestone after "received").
          confirmedAt: new Date(),
          // Record the advance actually captured online (for partial orders).
          ...(balanceDue > 0 ? { paidUpi: expectedNow } : {}),
          // razorpayPaymentId column repurposed as the generic gateway payment id
          // (PayU mihpayid) — avoids a schema migration on the live DB.
          razorpayPaymentId: fields.mihpayid ?? fields.payuMoneyId ?? null,
        },
      });
    });

    // Payment captured → auto-book the courier shipment (idempotent, never
    // blocks the redirect, safe if QuikShipX isn't configured).
    void autoBookShipment(order.id);

    // Confirmation only goes out once payment is actually captured.
    if (order.billingEmail) {
      notifyOnlineOrderPlaced(order.billingEmail, {
        orderId: order.id,
        orderNumber: order.id.slice(-8).toUpperCase(),
        customerName: order.billingName ?? "there",
        customerEmail: order.billingEmail,
        customerPhone: order.billingPhone ?? undefined,
        total: order.total,
        itemCount: order.items.length,
      }).catch(() => {});
    }

    // Deliver the tax-invoice PDF (email attachment + WhatsApp document) once
    // payment is captured. Fire-and-forget — never blocks the redirect.
    void sendOrderBill(order.id).catch((err) => console.error("[Bill] online delivery failed:", err));

    return redirect(`/checkout/success?order=${order.id}`);
  }

  // Failed / cancelled / amount-mismatch → void the order. A PENDING online
  // order never held stock (deduction happens at fulfilment), so there's
  // nothing to return; we only restore if it was somehow already deducted.
  try {
    await db.$transaction(async (tx) => {
      if (order.stockDeducted) {
        for (const it of order.items) {
          if (!it.variantId) continue;
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.quantity } },
          });
        }
        await syncLastPieceForVariants(tx, order.items.map((it) => it.variantId));
      }
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "FAILED", status: "CANCELLED", stockDeducted: false },
      });
    });
  } catch (err) {
    console.error("[payu] failed to void order", order.id, err);
  }

  return redirect(`/checkout/failed?order=${order.id}`);
}

// PayU posts via POST; guard GET so a stray visit doesn't 500.
export async function GET() {
  return redirect("/checkout");
}

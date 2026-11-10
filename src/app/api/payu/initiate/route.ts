import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, callerIp } from "@/lib/rate-limit";
import { PAYU_PAYMENT_URL, buildPaymentParams, payuCallbackBase, payuConfigured } from "@/lib/payu";

// POST /api/payu/initiate  { orderId }
//
// Returns the signed PayU form params for an already-created PENDING online
// order. The client auto-submits a form with these to PAYU_PAYMENT_URL. The
// amount and identity are read from the stored order (never trusted from the
// client), so this is safe to call without a session — the order id is an
// unguessable cuid and we refuse anything that isn't a fresh unpaid online order.

const bodySchema = z.object({ orderId: z.string().min(1).max(40) });

export async function POST(req: NextRequest) {
  const ip = callerIp(req);
  const rl = rateLimit({ key: `payu-initiate:${ip}`, max: 30, windowMs: 60_000 });
  if (rl.limited) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  if (!payuConfigured()) {
    return NextResponse.json({ error: "Online payment is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const order = await db.order.findUnique({
    where: { id: parsed.data.orderId },
    select: {
      id: true,
      total: true,
      paidCredit: true,
      source: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      billingName: true,
      billingEmail: true,
      billingPhone: true,
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ error: "Order is already paid." }, { status: 409 });
  }
  if (order.source !== "ONLINE" || order.paymentMethod === "COD") {
    return NextResponse.json({ error: "This order is not an online prepaid order." }, { status: 400 });
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Order is no longer payable." }, { status: 409 });
  }
  if (!order.total || order.total <= 0) {
    return NextResponse.json({ error: "Order total is zero." }, { status: 400 });
  }
  if (!order.billingEmail) {
    return NextResponse.json({ error: "Order is missing a customer email." }, { status: 400 });
  }

  // Charge only what's due online now: the full total normally, or just the
  // advance (total − balance-on-delivery) for a partial-payment order.
  const amountNow = Math.max(0, order.total - (order.paidCredit ?? 0));
  if (amountNow <= 0) {
    return NextResponse.json({ error: "Nothing due online for this order." }, { status: 400 });
  }

  const base = payuCallbackBase();
  const params = buildPaymentParams({
    // txnid == order.id: a cuid, alphanumeric, ≤25 chars (within PayU's limit).
    // Failed attempts cancel the order, so a retry is always a fresh order/txnid.
    txnid: order.id,
    amount: amountNow.toFixed(2),
    productinfo: `Order ${order.id.slice(-8).toUpperCase()}`,
    firstname: (order.billingName || "Customer").slice(0, 60),
    email: order.billingEmail,
    phone: (order.billingPhone || "").replace(/\D/g, "").slice(-10),
    surl: `${base}/api/payu/callback`,
    furl: `${base}/api/payu/callback`,
  });

  return NextResponse.json({ action: PAYU_PAYMENT_URL, params });
}

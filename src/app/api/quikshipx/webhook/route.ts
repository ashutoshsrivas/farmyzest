import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { OrderStatus, ShipmentStatus } from "@prisma/client";
import { applyOrderStatusTransition } from "@/lib/order-transition";

// POST /api/quikshipx/webhook — status-sync receiver.
//
// QuikShipX (or a courier status feed) POSTs a shipment status update here; we
// match it to our order by AWB/shipment ref (or the client order id we sent),
// advance the order's status through the SAME transition logic the admin uses
// (so stock + loyalty + the tracking timeline stay correct), and update the
// Shipment row. Because we don't yet have QuikShipX's exact payload spec, the
// parser is deliberately forgiving (checks many field names + one nesting
// level) and every call is logged raw so the mapping can be tightened once a
// real event is seen.
//
// Security: if QUIKSHIPX_WEBHOOK_SECRET is set, the caller must present it via
// the `x-webhook-secret` header OR a `?secret=` query param (so it works even
// when the courier can't send custom headers — you just register the URL with
// the secret in the query string).

export const dynamic = "force-dynamic";

// Map a free-text courier status → our ShipmentStatus + (optional) OrderStatus.
function mapStatus(raw: string): { shipment: ShipmentStatus; order: OrderStatus | null } | null {
  const s = raw.toLowerCase();
  if (/out.?for.?deliver|\bofd\b/.test(s)) return { shipment: "OUT_FOR_DELIVERY", order: "OUT_FOR_DELIVERY" };
  if (/deliver/.test(s)) return { shipment: "DELIVERED", order: "DELIVERED" };
  if (/rto|return/.test(s)) return { shipment: "RETURNED", order: "RETURNED" };
  if (/cancel/.test(s)) return { shipment: "PENDING", order: "CANCELLED" };
  if (/ship|transit|manifest|dispatch|pick|scan|bagged|in.?transit/.test(s))
    return { shipment: "SHIPPED", order: "SHIPPED" };
  return null; // unknown → leave everything as-is (still 200 so no retry storm)
}

// Pull a value out of the body by any of the candidate keys, checking the top
// level and one level of common nesting (data / response[0]).
function pick(body: unknown, keys: string[]): string | null {
  const scopes: Record<string, unknown>[] = [];
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    scopes.push(b);
    if (b.data && typeof b.data === "object") scopes.push(b.data as Record<string, unknown>);
    if (Array.isArray(b.response) && b.response[0] && typeof b.response[0] === "object")
      scopes.push(b.response[0] as Record<string, unknown>);
  }
  for (const scope of scopes) {
    for (const k of keys) {
      const v = scope[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Optional shared secret.
  const secret = process.env.QUIKSHIPX_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Accept JSON or form-encoded bodies.
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    try {
      body = Object.fromEntries((await req.formData()).entries());
    } catch {
      /* empty */
    }
  }
  console.log("[QuikShipX webhook]", JSON.stringify(body).slice(0, 1500));

  const ref = pick(body, ["awb", "awb_number", "awb_no", "waybill", "id", "shipment_id", "tracking_id", "tracking_number"]);
  const clientOrderId = pick(body, ["customer_order_id", "client_order_id", "order_ref", "reference"]);
  const statusStr = pick(body, ["status", "current_status", "shipment_status", "status_name", "order_status", "status_text"]);

  if (!statusStr) return NextResponse.json({ ok: false, note: "no status field found" }, { status: 400 });

  // Resolve our order: prefer the shipment ref (the id we stored), else the
  // client order id we sent as customer_order_id.
  let orderId: string | null = null;
  if (ref) {
    const sh = await db.shipment.findFirst({ where: { trackingNumber: ref }, select: { orderId: true } });
    orderId = sh?.orderId ?? null;
  }
  if (!orderId && clientOrderId) {
    const o = await db.order.findFirst({
      where: { OR: [{ id: clientOrderId }, { posOrderNum: clientOrderId }] },
      select: { id: true },
    });
    orderId = o?.id ?? null;
  }
  // 200 (not an error) so the courier doesn't retry forever on an unknown ref.
  if (!orderId) return NextResponse.json({ ok: true, note: "no matching order" });

  const mapped = mapStatus(statusStr);
  if (!mapped) return NextResponse.json({ ok: true, note: `unmapped status: ${statusStr}` });

  await db.$transaction(async (tx) => {
    await tx.shipment.updateMany({
      where: { orderId: orderId! },
      data: {
        status: mapped.shipment,
        ...(mapped.shipment === "SHIPPED" ? { shippedAt: new Date() } : {}),
        ...(mapped.shipment === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });
    if (mapped.order) {
      const order = await tx.order.findUnique({
        where: { id: orderId! },
        include: { items: { select: { variantId: true, quantity: true } } },
      });
      if (order && order.status !== mapped.order) {
        await applyOrderStatusTransition(tx, order, mapped.order);
      }
    }
  });

  return NextResponse.json({ ok: true, orderId, status: mapped.order ?? mapped.shipment });
}

// Some providers "ping" the webhook with a GET to validate it — answer 200.
export function GET() {
  return NextResponse.json({ ok: true, service: "quikshipx-webhook" });
}

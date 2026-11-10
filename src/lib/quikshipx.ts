import type { Order, OrderItem } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/wallet";

// ── QuikShipX courier integration ────────────────────────────────────────────
// Books a shipment ("Create Order v1") with QuikShipX from one of our orders.
// Docs: POST {BASE}/api/create-order-v1 with customer / shipment / product /
// shipper sections (all field values are strings). Credentials live ONLY in the
// server environment — never in git or the DB:
//
//   QUIKSHIPX_BASE_URL      default https://head.quikshipx.com
//   QUIKSHIPX_CLIENT_CODE   your client code (e.g. STY054)
//   QUIKSHIPX_USER_ID       your registered user id
//   QUIKSHIPX_USER_SECRET   LIVE secret for real bookings (TEST secret books test orders)
//   QUIKSHIPX_WAREHOUSE_ID  pickup warehouse id registered with QuikShipX
//
// Optional package defaults (orders don't carry weight/dimensions):
//   QUIKSHIPX_DEFAULT_WEIGHT_G (default 500), _LENGTH_CM/_WIDTH_CM/_HEIGHT_CM (10/20/30)

const BASE = process.env.QUIKSHIPX_BASE_URL || "https://head.quikshipx.com";
const CLIENT_CODE = process.env.QUIKSHIPX_CLIENT_CODE;
const USER_ID = process.env.QUIKSHIPX_USER_ID;
const USER_SECRET = process.env.QUIKSHIPX_USER_SECRET;
const WAREHOUSE_ID = process.env.QUIKSHIPX_WAREHOUSE_ID;

const DEF_WEIGHT = process.env.QUIKSHIPX_DEFAULT_WEIGHT_G || "500";
const DEF_LEN = process.env.QUIKSHIPX_DEFAULT_LENGTH_CM || "10";
const DEF_WID = process.env.QUIKSHIPX_DEFAULT_WIDTH_CM || "20";
const DEF_HEI = process.env.QUIKSHIPX_DEFAULT_HEIGHT_CM || "30";

/** All required credentials present? */
export function isQuikShipxConfigured(): boolean {
  return !!(CLIENT_CODE && USER_ID && USER_SECRET && WAREHOUSE_ID);
}

/** Human list of which required env vars are still missing (for admin errors). */
export function quikShipxMissing(): string[] {
  const miss: string[] = [];
  if (!CLIENT_CODE) miss.push("QUIKSHIPX_CLIENT_CODE");
  if (!USER_ID) miss.push("QUIKSHIPX_USER_ID");
  if (!USER_SECRET) miss.push("QUIKSHIPX_USER_SECRET");
  if (!WAREHOUSE_ID) miss.push("QUIKSHIPX_WAREHOUSE_ID");
  return miss;
}

const s = (v: unknown): string => (v == null ? "" : String(v));
const s2 = (v: number | null | undefined): string =>
  v == null ? "0" : String(Math.round(v * 100) / 100);

// QuikShipX wants a date like "14 March 2026".
function fmtOrderDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export type ShipmentOverrides = {
  weightGrams?: string | number;
  lengthCm?: string | number;
  widthCm?: string | number;
  heightCm?: string | number;
  packageType?: "1" | "2"; // 1 Flyer, 2 Cardboard
  shippingMode?: "1" | "2"; // 1 SURFACE, 2 EXPRESS
};

export type BookResult =
  | { ok: true; awb: string | null; trackingUrl: string | null; raw: unknown }
  | { ok: false; error: string; status?: number; raw?: unknown };

type OrderForBooking = Order & { items: OrderItem[] };

/**
 * Build the create-order payload for an order. Amounts are GST-inclusive rupees
 * (as stored). Pay mode is derived: an order with an outstanding balance
 * (paidCredit) or a COD payment method ships COD; everything else is prepaid.
 */
export function buildCreateOrderPayload(order: OrderForBooking, o: ShipmentOverrides = {}) {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Prepaid vs COD. A fully-paid online order settles via paymentStatus = PAID
  // (the gateway amount is NOT recorded in paidCash/paidUpi/paidCard, so those
  // stay 0). Deriving "received" only from the split-tender fields therefore
  // mislabels every prepaid PayU order as COD. So: fully PAID → prepaid; a
  // PARTIAL/unpaid order → COD for the balance owed on delivery (paidCredit
  // holds the balance-on-delivery for partial-payment orders).
  const received = order.paidCash + order.paidUpi + order.paidCard + order.walletApplied;
  const balanceOwed =
    order.paymentStatus === "PAID"
      ? 0
      : Math.max(0, order.paidCredit > 0 ? order.paidCredit : order.total - received);
  const isCOD = balanceOwed > 0.5;
  const codAmount = isCOD ? balanceOwed : 0;

  // Product lines. product_amount is the per-unit MRP/list (GST-incl) and
  // product_discount is the line's total discount. QuikShipX validates that
  // order_amount == Σ(product_amount × qty − product_discount), so we derive
  // order_amount from THESE numbers — never from order.total (which also folds
  // in bill-level discounts / charges / rounding and would fail that check).
  const productLines = order.items.map((it) => {
    const unit = round2(it.listPrice ?? it.unitPrice ?? 0);
    const lineDiscount = round2(it.discount ?? 0);
    return {
      product_name: s(it.productName),
      product_category: "General",
      product_sku_code: s(it.sku || it.barcode || ""),
      product_tax_rate: s2(it.taxPercent),
      product_hsn_code: "hsn",
      product_amount: String(unit),
      product_discount: String(lineDiscount),
      product_quantity: s(it.quantity),
    };
  });
  const orderAmount = round2(
    order.items.reduce(
      (sum, it) => sum + round2(it.listPrice ?? it.unitPrice ?? 0) * it.quantity - round2(it.discount ?? 0),
      0
    )
  );

  return {
    customer_details: {
      customer_full_name: s(order.shippingName || order.billingName || "Customer"),
      customer_phone_number: s(normalizePhone(order.shippingPhone || order.billingPhone) || order.shippingPhone || order.billingPhone),
      customer_full_address: s(order.shippingAddress || order.billingAddress),
      customer_pincode: s(order.shippingPincode || order.billingPincode),
      customer_order_id: s(order.posOrderNum || order.id),
      customer_order_date: fmtOrderDate(new Date(order.createdAt)),
      customer_address_type: "1",
      customer_email_id: s(order.billingEmail || ""),
      customer_alternate_phone_number: "",
      customer_landmark: "",
    },
    shipment_details: {
      shipment_package_type: s(o.packageType || "1"),
      shipment_dead_weight_in_grams: s(o.weightGrams || DEF_WEIGHT),
      shipment_length: s(o.lengthCm || DEF_LEN),
      shipment_width: s(o.widthCm || DEF_WID),
      shipment_height: s(o.heightCm || DEF_HEI),
      shipment_pickup_warehouse_id: s(WAREHOUSE_ID),
      shipment_shipping_mode: s(o.shippingMode || "1"),
      shipment_pay_mode: isCOD ? "1" : "2",
      order_amount: String(orderAmount),
      cod_amount: s2(codAmount),
      commodity_amount: s2(order.subtotal),
      shipping_amount: s2(order.additionalCharges),
      discount_amount: s2(order.discount),
      discount_coupon_name: "",
    },
    product_details: productLines,
    shipper_details: {
      client_code: s(CLIENT_CODE),
      user_id: s(USER_ID),
      user_secret: s(USER_SECRET),
    },
  };
}

// Confirmed success body (from a live smoke test):
//   { "response": [ { "id": 64960571957, "status": "success", "order_id": 164213 } ] }
// `id` is the shipment reference; `order_id` is QuikShipX's order number.
type QsRow = { id?: number | string; order_id?: number | string; status?: string; message?: string; errors?: string[] };

function firstRow(body: unknown): QsRow | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const arr = Array.isArray(b.response) ? b.response : Array.isArray(b.data) ? b.data : null;
  if (arr && arr.length && typeof arr[0] === "object") return arr[0] as QsRow;
  // Some responses may be a bare object rather than an array.
  if (!Array.isArray(b.response) && (b.id != null || b.order_id != null)) return b as QsRow;
  return null;
}

/** Pull the shipment reference (id, else order_id) out of a success row. */
function extractAwb(body: unknown): string | null {
  const row = firstRow(body);
  if (!row) return null;
  const ref = row.id ?? row.order_id;
  return ref != null && String(ref).trim() ? String(ref).trim() : null;
}

/**
 * Fire-and-forget auto-booking used by the payment callback + admin transition.
 * Idempotent (skips if already booked), silently no-ops when unconfigured or the
 * order lacks an address/pincode, and NEVER throws — a courier hiccup must never
 * break checkout or a status change. Records the AWB on the order's Shipment.
 */
export async function autoBookShipment(orderId: string): Promise<void> {
  if (!isQuikShipxConfigured()) return;
  try {
    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, shipment: true } });
    if (!order || order.shipment?.trackingNumber) return; // gone, or already booked
    if (!(order.shippingAddress || order.billingAddress) || !(order.shippingPincode || order.billingPincode)) return;
    const result = await bookShipment(order);
    if (!result.ok) {
      console.error("[QuikShipX auto-book]", orderId, result.error, result.raw ?? "");
      return;
    }
    await db.shipment.upsert({
      where: { orderId },
      create: { orderId, courier: "QuikShipX", trackingNumber: result.awb, trackingUrl: result.trackingUrl, status: "PENDING" },
      update: { courier: "QuikShipX", trackingNumber: result.awb, trackingUrl: result.trackingUrl },
    });
    console.log("[QuikShipX auto-book] booked", orderId, "AWB", result.awb);
  } catch (e) {
    console.error("[QuikShipX auto-book] error", orderId, e);
  }
}

/** Book the shipment. Never throws — returns a typed result the caller renders. */
export async function bookShipment(
  order: OrderForBooking,
  overrides: ShipmentOverrides = {}
): Promise<BookResult> {
  if (!isQuikShipxConfigured()) {
    return { ok: false, error: `QuikShipX not configured — missing ${quikShipxMissing().join(", ")}` };
  }
  const payload = buildCreateOrderPayload(order, overrides);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${BASE}/api/create-order-v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let raw: unknown = text;
    try { raw = JSON.parse(text); } catch { /* keep as text */ }

    if (!res.ok) {
      const msg =
        (raw && typeof raw === "object" && "message" in (raw as object)
          ? String((raw as Record<string, unknown>).message)
          : "") || `QuikShipX returned ${res.status}`;
      return { ok: false, error: msg, status: res.status, raw };
    }
    // A 200 can still carry a per-row failure (status !== "success").
    const row = firstRow(raw);
    if (row && row.status && row.status !== "success") {
      const detail =
        Array.isArray(row.errors) && row.errors.length
          ? row.errors.join("; ")
          : row.message
          ? String(row.message)
          : `rejected (${row.status})`;
      return { ok: false, error: `QuikShipX: ${detail}`, raw };
    }
    const awb = extractAwb(raw);
    // No documented tracking-URL endpoint yet — leave it null rather than link to a 404.
    return { ok: true, awb, trackingUrl: null, raw };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "QuikShipX request timed out" : "Network error contacting QuikShipX" };
  } finally {
    clearTimeout(timer);
  }
}

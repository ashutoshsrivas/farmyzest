export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ChevronLeft, MapPin, CreditCard, Package, User, ArrowLeftRight, FileText, StickyNote, Monitor } from "lucide-react";
import { ExchangePanel } from "@/components/admin/ExchangePanel";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import { DeleteBillButton } from "@/components/admin/DeleteBillButton";
import { ShipOrderButton } from "@/components/admin/ShipOrderButton";
import { EditOrderPanel } from "@/components/admin/EditOrderPanel";
import { CollectBalanceButton } from "./_components/CollectBalanceButton";
import { ProductPeek } from "@/components/store/ProductQuickView";
import { hasBill } from "@/lib/order-status";
import { buildOrderInvoice } from "@/lib/order-invoice";

// Percentage without noisy trailing zeros: 10.00 → "10", 12.50 → "12.5".
const pct = (n: number) => {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};

// Admin-side order detail. Supports live status transitions, exchange/return,
// a full bill edit (items/qty/price/discount), and a printable A5 GST invoice.

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-orange-100 text-orange-700",
};

// Online-order tracking milestones + their progress order (mirrors the customer
// tracker). Each maps to a stamped timestamp on the Order row.
const STATUS_TIMELINE = [
  { status: "PENDING", label: "Order Received" },
  { status: "PROCESSING", label: "Order Confirmed" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DELIVERED", label: "Delivered" },
] as const;
const STATUS_STEP: Record<string, number> = {
  PENDING: 0, PROCESSING: 1, SHIPPED: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4,
  CANCELLED: -1, RETURNED: -1,
};
const fmtStamp = (d: Date | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      shipment: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      salesman: { select: { id: true, name: true } },
      attendedBy: { select: { id: true, name: true } },
      exchanges: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });

  if (!order) notFound();

  // Resolve each line's product slug for the quick-view → product page link.
  const itemProductIds = order.items.map((i) => i.productId).filter((v): v is string => !!v);
  const slugRows = itemProductIds.length
    ? await db.product.findMany({ where: { id: { in: itemProductIds } }, select: { id: true, slug: true } })
    : [];
  const slugByProductId = new Map(slugRows.map((p) => [p.id, p.slug]));

  // An order can be re-rung while it's still live and untouched by exchanges.
  const editable =
    order.status !== "CANCELLED" &&
    order.status !== "RETURNED" &&
    order.exchanges.length === 0;

  // Seed the editor from the saved order. Stored per-line `discount` is an
  // amount, so it round-trips as a FIXED line discount; whatever discount isn't
  // on a line is the original bill-level discount.
  const lineDiscountSum = order.items.reduce((s, it) => s + (it.discount ?? 0), 0);
  const billDiscountAmount = Math.max(0, order.discount - lineDiscountSum);
  const initialItems = order.items.map((it) => ({
    key: `i-${it.id}`,
    variantId: it.variantId,
    productId: it.productId,
    name: it.productName,
    variantLabel: it.variantLabel,
    sku: it.sku,
    unitPrice: it.listPrice ?? it.unitPrice,
    quantity: it.quantity,
    discountType: "FIXED" as const,
    discountValue: it.discount ?? 0,
  }));

  // Per-line MRP / discount% / discounted value — same maths as the A5 invoice.
  // Online orders show each line's CURRENT auto-tier % (15/20/25/30 by spend),
  // POS bills show the discount actually rung. GST rate is irrelevant to the
  // pre-tax fields we read here, so pass 0. See src/lib/order-invoice.ts.
  const inv = await buildOrderInvoice(order, 0);
  const invLines = inv.lines;
  // Summary figures mirror the breakup so the panel and the item list always
  // agree — for online orders this reflects the current-offer discount, not the
  // stale blended total once stored on the row.
  const summary = {
    subtotal: inv.totals.grossSubtotal,
    discount: inv.totals.totalDiscount,
    total: inv.totals.grandTotal,
  };

  // Status timeline (online orders only; POS bills are instant counter sales).
  const currentStep = STATUS_STEP[order.status] ?? -1;
  const stepTimes: Record<string, Date | null> = {
    PENDING: order.createdAt,
    PROCESSING: order.confirmedAt,
    SHIPPED: order.shippedAt,
    OUT_FOR_DELIVERY: order.outForDeliveryAt,
    DELIVERED: order.deliveredAt,
  };
  const showTimeline =
    order.source === "ONLINE" && order.status !== "CANCELLED" && order.status !== "RETURNED";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-nate-grey-800">
              Order {order.posOrderNum ?? `#${order.id.slice(0, 8).toUpperCase()}`}
            </h1>
            <p className="text-sm text-nate-grey-500 mt-1">
              Placed{" "}
              {new Date(order.createdAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {order.source === "POS" ? "POS sale" : "Online order"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live status changer — PATCHes /api/admin/orders/[id] and
                restocks automatically when moved to Cancelled/Returned. */}
            <OrderStatusControl orderId={order.id} currentStatus={order.status} />
            <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-nate-grey-100 text-nate-grey-600">
              {order.paymentMethod} · {order.paymentStatus}
            </span>
            {/* Courier booking (QuikShipX) — online orders are delivered; POS
                sales are walk-in and never shipped. */}
            {order.source === "ONLINE" && (
              <ShipOrderButton
                orderId={order.id}
                awb={order.shipment?.trackingNumber ?? null}
                trackingUrl={order.shipment?.trackingUrl ?? null}
              />
            )}
            <DeleteBillButton
              orderId={order.id}
              orderRef={order.posOrderNum ?? `#${order.id.slice(0, 8).toUpperCase()}`}
            />
            {/* A bill exists only for ACTIVE orders (Processing / Shipped /
                Out-for-delivery / Delivered). Hidden for Pending / Cancelled /
                Returned — no bill is generated for those. */}
            {hasBill(order.status) && (
              <a
                href={`/invoice/${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-50 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                A5 Invoice
              </a>
            )}
            {order.source === "POS" && editable && (
              <a
                href={`/pos?edit=${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border border-nate-grey-800 bg-nate-grey-800 text-white hover:bg-nate-grey-700 transition-colors"
              >
                <Monitor className="w-3.5 h-3.5" />
                Edit in POS
              </a>
            )}
            {editable && (
              <EditOrderPanel
                orderId={order.id}
                initialItems={initialItems}
                initialBillDiscount={{ type: "FIXED", value: billDiscountAmount }}
                initialCustomerName={order.billingName ?? ""}
                initialCustomerPhone={order.billingPhone ?? ""}
              />
            )}
            <ExchangePanel
              orderId={order.id}
              orderItems={order.items.map((it) => ({
                id: it.id,
                productName: it.productName,
                variantLabel: it.variantLabel,
                variantId: it.variantId,
                sku: it.sku,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                imageUrl: it.imageUrl,
              }))}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items + Shipment */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-base font-medium text-nate-grey-800">
                Items ({order.items.length})
              </h2>
            </div>
            <div className="divide-y divide-nate-grey-100">
              {order.items.map((item, idx) => {
                const slug = item.productId ? slugByProductId.get(item.productId) : undefined;
                const line = invLines[idx];
                return (
                <div key={item.id} className="px-6 py-4 flex items-start gap-4">
                  <ProductPeek slug={slug} name={item.productName} image={item.imageUrl ?? undefined}
                    className="w-14 h-14 rounded-lg overflow-hidden bg-nate-grey-100 shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-nate-grey-300" />
                    )}
                  </ProductPeek>
                  <div className="flex-1 min-w-0">
                    <ProductPeek slug={slug} name={item.productName} image={item.imageUrl ?? undefined}>
                      <p className={`text-sm font-medium text-nate-grey-800 truncate ${slug ? "hover:text-accent" : ""}`}>
                        {item.productName}
                      </p>
                    </ProductPeek>
                    {item.variantLabel && (
                      <p className="text-xs text-nate-grey-500 mt-0.5">{item.variantLabel}</p>
                    )}
                    <p className="text-xs text-nate-grey-400 mt-0.5 font-mono">
                      SKU {item.sku} · BC {item.barcode ?? "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {/* Discounted value (what was charged for this line) */}
                    <p className="text-sm font-medium text-nate-grey-800">
                      ₹{(line?.lineTotal ?? item.totalPrice).toFixed(2)}
                    </p>
                    {/* MRP per unit × qty */}
                    <p className="text-xs text-nate-grey-500 mt-0.5">
                      {item.quantity} × MRP ₹{(line?.listUnit ?? item.unitPrice).toFixed(2)}
                    </p>
                    {/* Discount % + amount for this item, or the Special Prices
                        note (already marked down — no further discount stacks). */}
                    {line && line.discount > 0 ? (
                      <p className="text-xs text-green-600 mt-0.5 font-medium">
                        {pct(line.discountPct)}% off · −₹{line.discount.toFixed(2)}
                      </p>
                    ) : line?.isSpecialPrice ? (
                      <p className="text-[11px] text-amber-600 mt-0.5 font-medium">
                        Special price · no extra discount
                      </p>
                    ) : null}
                    {item.taxPercent ? (
                      <p className="text-[11px] text-nate-grey-400 mt-0.5">incl. {item.taxPercent}% GST</p>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Status timeline (online orders) */}
          {showTimeline && (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-nate-grey-600" />
                <h2 className="text-base font-medium text-nate-grey-800">Status timeline</h2>
              </div>
              <ol className="px-6 py-5">
                {STATUS_TIMELINE.map((step, i) => {
                  const stepIdx = STATUS_STEP[step.status] ?? 0;
                  const done = currentStep >= stepIdx;
                  const current = currentStep === stepIdx;
                  const when = fmtStamp(stepTimes[step.status]);
                  const last = i === STATUS_TIMELINE.length - 1;
                  return (
                    <li key={step.status} className="relative flex gap-4 pb-5 last:pb-0">
                      {/* connector line */}
                      {!last && (
                        <span
                          className={`absolute left-[7px] top-4 bottom-0 w-0.5 ${
                            currentStep > stepIdx ? "bg-green-500" : "bg-nate-grey-200"
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 mt-0.5 w-4 h-4 rounded-full shrink-0 ${
                          done
                            ? "bg-green-500"
                            : current
                            ? "bg-blue-500 ring-2 ring-blue-200"
                            : "bg-nate-grey-200"
                        }`}
                      />
                      <div className="flex-1 flex items-baseline justify-between gap-3 -mt-0.5">
                        <span
                          className={`text-sm ${
                            done ? "font-medium text-nate-grey-800" : "text-nate-grey-400"
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="text-xs tabular-nums text-nate-grey-400 whitespace-nowrap">
                          {when ?? (done ? "—" : "")}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Exchange history */}
          {order.exchanges.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-nate-grey-600" />
                <h2 className="text-base font-medium text-nate-grey-800">
                  Exchanges ({order.exchanges.length})
                </h2>
              </div>
              <div className="divide-y divide-nate-grey-100">
                {order.exchanges.map((ex) => (
                  <div key={ex.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-nate-grey-500 font-mono">
                          {ex.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-nate-grey-500">
                          {new Date(ex.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${
                            ex.priceDifference > 0
                              ? "text-amber-700"
                              : ex.priceDifference < 0
                              ? "text-green-700"
                              : "text-nate-grey-700"
                          }`}
                        >
                          {ex.priceDifference > 0
                            ? `+₹${Math.round(ex.priceDifference).toLocaleString("en-IN")}`
                            : ex.priceDifference < 0
                            ? `−₹${Math.round(Math.abs(ex.priceDifference)).toLocaleString("en-IN")}`
                            : "Even"}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-nate-grey-500">
                          {ex.priceDifference > 0
                            ? "customer paid extra"
                            : ex.priceDifference < 0
                            ? "refund issued"
                            : "even exchange"}
                        </p>
                      </div>
                    </div>
                    {ex.reason && (
                      <p className="text-sm text-nate-grey-600">{ex.reason}</p>
                    )}
                    <p className="text-xs text-nate-grey-500 mt-1">
                      {ex.items.length} line{ex.items.length === 1 ? "" : "s"} ·{" "}
                      {ex.items.reduce((s, i) => s + i.returnedQuantity, 0)} returned ·{" "}
                      {ex.items.reduce((s, i) => s + i.replacementQuantity, 0)} replaced
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.shipment && (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-base font-medium text-nate-grey-800">Shipment</h2>
              </div>
              <div className="px-6 py-4 space-y-2 text-sm">
                {order.shipment.courier && (
                  <div className="flex justify-between">
                    <span className="text-nate-grey-500">Courier</span>
                    <span className="text-nate-grey-800">{order.shipment.courier}</span>
                  </div>
                )}
                {order.shipment.trackingNumber && (
                  <div className="flex justify-between">
                    <span className="text-nate-grey-500">Tracking</span>
                    <span className="text-nate-grey-800 font-mono text-xs">
                      {order.shipment.trackingNumber}
                    </span>
                  </div>
                )}
                {order.shipment.trackingUrl && (
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2 text-sm text-accent hover:underline"
                  >
                    Open tracking page →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary + Customer */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-base font-medium text-nate-grey-800">Order summary</h2>
            </div>
            <div className="px-6 py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-nate-grey-500">Subtotal</span>
                <span className="text-nate-grey-800">₹{summary.subtotal.toFixed(2)}</span>
              </div>
              {summary.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-nate-grey-500">Discount</span>
                  <span className="text-green-600">−₹{summary.discount.toFixed(2)}</span>
                </div>
              )}
              {order.loyaltyDiscount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-nate-grey-400 pl-3">
                    incl. loyalty points redeemed
                    {order.pointsRedeemed ? ` (${order.pointsRedeemed} pts)` : ""}
                  </span>
                  <span className="text-nate-grey-400">−₹{order.loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-nate-grey-500">Tax</span>
                <span className="text-nate-grey-800">₹{order.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-nate-grey-100 pt-2 mt-1">
                <span className="font-medium text-nate-grey-800">Total</span>
                <span className="font-medium text-nate-grey-800">
                  ₹{summary.total.toFixed(2)}
                </span>
              </div>
              {order.walletApplied > 0 && (
                <div className="flex justify-between">
                  <span className="text-nate-grey-500">Store credit used</span>
                  <span className="text-green-600">−₹{order.walletApplied.toFixed(2)}</span>
                </div>
              )}
              {order.paidCredit > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-nate-grey-500">Paid online (advance)</span>
                    <span className="text-green-700">
                      ₹{(order.total - order.walletApplied - order.paidCredit).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-amber-700">Balance due on delivery</span>
                    <span className="font-medium text-amber-700">₹{order.paidCredit.toFixed(2)}</span>
                  </div>
                  <CollectBalanceButton orderId={order.id} amount={order.paidCredit} />
                </>
              ) : (
                order.walletApplied > 0 && (
                  <div className="flex justify-between">
                    <span className="font-medium text-nate-grey-800">Amount paid</span>
                    <span className="font-medium text-nate-grey-800">
                      ₹{(order.total - order.walletApplied).toFixed(2)}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Real customer — linked account, else the contact captured on the
              order (POS / guest checkout). Phone is the identifier. */}
          {(() => {
            const name =
              order.user?.name ||
              order.billingName ||
              (order.source === "POS" ? "Walk-in customer" : "Guest");
            const phone = order.user?.phone || order.billingPhone || null;
            const email = order.user?.email || null;
            return (
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
                  <h2 className="text-base font-medium text-nate-grey-800 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Customer
                  </h2>
                  {!order.user && (
                    <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-nate-grey-100 text-nate-grey-600">
                      {order.source === "POS" ? "POS" : "Guest"}
                    </span>
                  )}
                </div>
                <div className="px-6 py-4 space-y-1 text-sm">
                  <p className="font-medium text-nate-grey-800">{name}</p>
                  {phone ? (
                    <p className="text-nate-grey-600 font-mono">{phone}</p>
                  ) : (
                    <p className="text-nate-grey-400">No phone captured</p>
                  )}
                  {email && <p className="text-nate-grey-500">{email}</p>}
                  {phone && (
                    <Link
                      href={
                        order.user
                          ? `/admin/customers/${order.userId}`
                          : `/admin/customers/guest/${encodeURIComponent(phone)}`
                      }
                      className="inline-block text-xs text-accent hover:underline pt-1"
                    >
                      View customer →
                    </Link>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Internal remark captured at billing — staff-only, never printed on
              the customer receipt. */}
          {order.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-amber-200">
                <h2 className="text-base font-medium text-amber-900 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" />
                  Internal remark
                </h2>
                <p className="text-[11px] text-amber-700 mt-0.5">Staff-only — not shown to the customer.</p>
              </div>
              <div className="px-6 py-4 text-sm text-amber-900 whitespace-pre-wrap">{order.notes}</div>
            </div>
          )}

          {order.source === "POS" && (order.salesman || order.attendedBy) && (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-base font-medium text-nate-grey-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Staff
                </h2>
              </div>
              <div className="px-6 py-4 text-sm space-y-3">
                {order.salesman && (
                  <div>
                    <p className="text-xs text-nate-grey-400 uppercase tracking-wide">Billed by</p>
                    <p className="font-medium text-nate-grey-800">{order.salesman.name}</p>
                  </div>
                )}
                {order.attendedBy && (
                  <div>
                    <p className="text-xs text-nate-grey-400 uppercase tracking-wide">Attended by</p>
                    <p className="font-medium text-nate-grey-800">{order.attendedBy.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(order.shippingAddress || order.shippingName) && (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-base font-medium text-nate-grey-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shipping address
                </h2>
              </div>
              <div className="px-6 py-4 text-sm space-y-0.5">
                {order.shippingName && (
                  <p className="font-medium text-nate-grey-800">{order.shippingName}</p>
                )}
                {order.shippingPhone && (
                  <p className="text-nate-grey-500">{order.shippingPhone}</p>
                )}
                {order.shippingAddress && (
                  <p className="text-nate-grey-600 mt-1">{order.shippingAddress}</p>
                )}
                {(order.shippingCity || order.shippingState || order.shippingPincode) && (
                  <p className="text-nate-grey-500">
                    {[order.shippingCity, order.shippingState, order.shippingPincode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

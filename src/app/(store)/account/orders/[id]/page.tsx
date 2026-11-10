import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  Package,
  ChevronRight,
  MapPin,
  CreditCard,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { CancelOrderButton } from "@/components/account/CancelOrderButton";
import { RequestReturnButton } from "@/components/account/RequestReturnButton";
import { ProductPeek } from "@/components/store/ProductQuickView";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="w-4 h-4" />,
  PROCESSING: <Clock className="w-4 h-4" />,
  SHIPPED: <Truck className="w-4 h-4" />,
  OUT_FOR_DELIVERY: <Truck className="w-4 h-4" />,
  DELIVERED: <CheckCircle className="w-4 h-4" />,
  CANCELLED: <XCircle className="w-4 h-4" />,
  RETURNED: <RotateCcw className="w-4 h-4" />,
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-blue-100 text-blue-800",
  PARTIAL_REFUND: "bg-orange-100 text-orange-800",
};

const STATUS_TIMELINE = [
  { status: "PENDING", label: "Order Received" },
  { status: "PROCESSING", label: "Order Confirmed" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

const STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  CANCELLED: -1,
  RETURNED: -1,
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id, userId: session.user.id },
    include: {
      items: true,
      shipment: true,
    },
  });

  if (!order) notFound();

  // Resolve each line's product slug (for the quick-view → product page link).
  // Items whose product was removed from the catalogue simply stay non-clickable.
  const itemProductIds = order.items.map((i) => i.productId).filter((v): v is string => !!v);
  const slugRows = itemProductIds.length
    ? await db.product.findMany({ where: { id: { in: itemProductIds } }, select: { id: true, slug: true } })
    : [];
  const slugByProductId = new Map(slugRows.map((p) => [p.id, p.slug]));

  const orderNum = order.razorpayOrderId
    ? order.razorpayOrderId.slice(-8).toUpperCase()
    : order.id.slice(-8).toUpperCase();

  const currentStep = STATUS_ORDER[order.status] ?? -1;

  // Actual timestamp each milestone was reached (null = not yet / not recorded).
  // "Order Received" is always the creation time.
  const stepTimes: Record<string, Date | null> = {
    PENDING: order.createdAt,
    PROCESSING: order.confirmedAt,
    SHIPPED: order.shippedAt,
    OUT_FOR_DELIVERY: order.outForDeliveryAt,
    DELIVERED: order.deliveredAt,
  };
  const fmtStamp = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "";

  return (
    <>
      {/* Wrappers (bg, container, sidebar) live in (store)/account/layout.tsx. */}
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif text-nate-grey-800">
              Order #{orderNum}
            </h1>
            <p className="text-sm text-nate-grey-500 mt-0.5">
              Placed on{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <Link
            href="/account/orders"
            className="text-sm text-nate-grey-500 hover:text-accent transition-colors"
          >
            ← Back to Orders
          </Link>
        </div>

        {/* Status + Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  STATUS_COLORS[order.status] ?? "bg-nate-grey-100 text-nate-grey-600"
                }`}
              >
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
              {order.status !== "CANCELLED" && order.status !== "RETURNED" && (
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                    PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "bg-nate-grey-100 text-nate-grey-600"
                  }`}
                >
                  Payment: {order.paymentStatus}
                </span>
              )}
            </div>
          </div>

          {/* Timeline */}
          {order.status !== "CANCELLED" && order.status !== "RETURNED" && (
            <div className="relative">
              {/* Progress bar */}
              <div className="hidden sm:flex items-center mb-4">
                {STATUS_TIMELINE.map((step, i) => {
                  const stepIdx = STATUS_ORDER[step.status] ?? 0;
                  const isDone = currentStep >= stepIdx;
                  const isCurrent = currentStep === stepIdx;
                  return (
                    <div key={step.status} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                            isDone
                              ? "bg-accent text-white"
                              : isCurrent
                              ? "bg-blue-100 text-blue-700 ring-2 ring-blue-200"
                              : "bg-nate-grey-100 text-nate-grey-400"
                          }`}
                        >
                          {STATUS_ICONS[step.status]}
                        </div>
                        <p className="text-xs text-nate-grey-500 mt-1.5 text-center">
                          {step.label}
                        </p>
                        {isDone && stepTimes[step.status] && (
                          <p className="text-[10px] text-nate-grey-400 mt-0.5 text-center tabular-nums">
                            {fmtStamp(stepTimes[step.status])}
                          </p>
                        )}
                      </div>
                      {i < STATUS_TIMELINE.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-2 ${
                            currentStep >= (STATUS_ORDER[STATUS_TIMELINE[i + 1]?.status] ?? 0)
                              ? "bg-accent"
                              : "bg-nate-grey-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Items list */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-lg font-serif text-nate-grey-800">
                  Items ({order.items.length})
                </h2>
              </div>
              <div className="divide-y divide-nate-grey-100">
                {order.items.map((item) => {
                  const slug = item.productId ? slugByProductId.get(item.productId) : undefined;
                  return (
                  <div key={item.id} className="px-6 py-4 flex items-start gap-4">
                    <ProductPeek slug={slug} name={item.productName} image={item.imageUrl ?? undefined}
                      className="w-20 h-20 rounded-lg overflow-hidden bg-nate-grey-100 shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-nate-grey-300" />
                      )}
                    </ProductPeek>
                    <div className="flex-1 min-w-0">
                      <ProductPeek slug={slug} name={item.productName} image={item.imageUrl ?? undefined}>
                        <p className={`text-sm font-medium text-nate-grey-800 truncate ${slug ? "hover:text-accent" : ""}`}>
                          {item.productName}
                        </p>
                      </ProductPeek>
                      {item.variantLabel && (
                        <p className="text-xs text-nate-grey-500 mt-0.5">
                          {item.variantLabel}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-nate-grey-400 mt-0.5">SKU: {item.sku}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-nate-grey-500">
                          Qty: {item.quantity}
                        </span>
                        <span className="text-sm font-medium text-nate-grey-800">
                          ₹{item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-nate-grey-600">
                        ₹{item.unitPrice.toFixed(2)} each
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Shipment info */}
            {order.shipment && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-nate-grey-100">
                  <h2 className="text-lg font-serif text-nate-grey-800">Shipment</h2>
                </div>
                <div className="px-6 py-4 space-y-2">
                  {order.shipment.courier && (
                    <div className="flex justify-between text-sm">
                      <span className="text-nate-grey-500">Courier</span>
                      <span className="text-nate-grey-800 font-medium">
                        {order.shipment.courier}
                      </span>
                    </div>
                  )}
                  {order.shipment.trackingNumber && (
                    <div className="flex justify-between text-sm">
                      <span className="text-nate-grey-500">Tracking</span>
                      <span className="text-nate-grey-800 font-medium text-xs">
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
                      Track shipment →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Order summary + address */}
          <div className="space-y-4">
            {/* Order summary */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-lg font-serif text-nate-grey-800">
                  Order Summary
                </h2>
              </div>
              <div className="px-6 py-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-nate-grey-500">Subtotal</span>
                  <span className="text-nate-grey-800">₹{order.subtotal.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-nate-grey-500">Discount</span>
                    <span className="text-green-600">
                      -₹{order.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-nate-grey-500">Tax</span>
                  <span className="text-nate-grey-800">₹{order.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-nate-grey-100 pt-2.5 mt-2">
                  <span className="font-medium text-nate-grey-800">Total</span>
                  <span className="font-serif text-lg text-nate-grey-800">
                    ₹{order.total.toFixed(2)}
                  </span>
                </div>
                {order.walletApplied > 0 && (
                  <div className="flex justify-between">
                    <span className="text-nate-grey-500">Store credit used</span>
                    <span className="text-green-600">-₹{order.walletApplied.toFixed(2)}</span>
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
                <div className="flex justify-between mt-2 pt-2 border-t border-nate-grey-100">
                  <span className="text-nate-grey-500">Payment Method</span>
                  <span className="text-nate-grey-800 capitalize">
                    {order.paidCredit > 0
                      ? "Partial — advance paid, balance on delivery"
                      : order.paymentMethod.toLowerCase().replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Shipping address */}
            {(order.shippingAddress || order.shippingName) && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-nate-grey-100">
                  <h2 className="text-lg font-serif text-nate-grey-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Shipping Address
                  </h2>
                </div>
                <div className="px-6 py-4">
                  {order.shippingName && (
                    <p className="text-sm font-medium text-nate-grey-800">
                      {order.shippingName}
                    </p>
                  )}
                  {order.shippingPhone && (
                    <p className="text-xs text-nate-grey-500 mt-0.5">{order.shippingPhone}</p>
                  )}
                  {order.shippingAddress && (
                    <p className="text-sm text-nate-grey-600 mt-1">
                      {order.shippingAddress}
                    </p>
                  )}
                  {(order.shippingCity || order.shippingState || order.shippingPincode) && (
                    <p className="text-sm text-nate-grey-500 mt-1">
                      {[order.shippingCity, order.shippingState, order.shippingPincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Billing address */}
            {(order.billingAddress || order.billingName) && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-nate-grey-100">
                  <h2 className="text-lg font-serif text-nate-grey-800 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Billing Address
                  </h2>
                </div>
                <div className="px-6 py-4">
                  {order.billingName && (
                    <p className="text-sm font-medium text-nate-grey-800">{order.billingName}</p>
                  )}
                  {order.billingPhone && (
                    <p className="text-xs text-nate-grey-500 mt-0.5">{order.billingPhone}</p>
                  )}
                  {order.billingAddress && (
                    <p className="text-sm text-nate-grey-600 mt-1">{order.billingAddress}</p>
                  )}
                  {(order.billingCity || order.billingState || order.billingPincode) && (
                    <p className="text-sm text-nate-grey-500 mt-1">
                      {[order.billingCity, order.billingState, order.billingPincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Cancellation — only while still in cancellable state */}
            {(order.status === "PENDING" || order.status === "PROCESSING") && (
              <CancelOrderButton orderId={order.id} />
            )}

            {/* Returns — only after delivery */}
            {order.status === "DELIVERED" && (
              <RequestReturnButton orderId={order.id} orderTotal={order.total} />
            )}

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-nate-grey-100">
                  <h2 className="text-lg font-serif text-nate-grey-800">Notes</h2>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-nate-grey-600">{order.notes}</p>
                </div>
              </div>
          )}
        </div>
      </div>
    </>
  );
}
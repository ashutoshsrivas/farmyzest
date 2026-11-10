import Link from "next/link";
import { db } from "@/lib/db";
import { ClearCart } from "./ClearCart";

export const dynamic = "force-dynamic";

// Landing page PayU redirects the shopper to after a successful payment.
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const order = orderId
    ? await db.order.findUnique({
        where: { id: orderId },
        select: { id: true, total: true, paymentStatus: true },
      })
    : null;

  const number = order ? order.id.slice(-8).toUpperCase() : null;

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4 text-center max-w-lg">
        <ClearCart />
        <div className="text-6xl mb-6">✓</div>
        <h1 className="text-3xl font-serif mb-4">Payment Successful</h1>
        {number ? (
          <p className="text-nate-grey-500 mb-2">
            Order <span className="font-mono font-medium text-nate-grey-700">#{number}</span>
            {order ? ` · ₹${order.total.toFixed(2)} paid` : ""}
          </p>
        ) : null}
        <p className="text-nate-grey-500 mb-8">
          Thank you for your order. A confirmation has been sent to your email, and we’ll notify
          you when it ships.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/account/orders"
            className="inline-block bg-nate-grey-800 text-white px-8 py-4 rounded-lg hover:bg-nate-grey-700 transition-colors"
          >
            View Orders
          </Link>
          <Link
            href="/shop"
            className="inline-block border border-nate-grey-300 text-nate-grey-700 px-8 py-4 rounded-lg hover:bg-nate-grey-100 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

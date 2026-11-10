import Link from "next/link";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  verify: "We couldn’t verify the payment response. If money was deducted, it will be auto-refunded by your bank.",
  no_order: "We couldn’t find the order for this payment.",
  bad_response: "We received an unexpected response from the payment gateway.",
};

// Landing page PayU redirects the shopper to after a failed/cancelled payment.
export default async function CheckoutFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; reason?: string }>;
}) {
  const { order: orderId, reason } = await searchParams;
  const number = orderId ? orderId.slice(-8).toUpperCase() : null;
  const detail = reason ? REASONS[reason] : null;

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4 text-center max-w-lg">
        <div className="text-6xl mb-6">✕</div>
        <h1 className="text-3xl font-serif mb-4">Payment Not Completed</h1>
        {number ? (
          <p className="text-nate-grey-500 mb-2">
            Order <span className="font-mono font-medium text-nate-grey-700">#{number}</span> was not paid and has been released.
          </p>
        ) : null}
        <p className="text-nate-grey-500 mb-2">
          {detail ?? "Your payment didn’t go through, so the order wasn’t placed. No money has been charged — if any amount was deducted, your bank will reverse it within 5–7 business days."}
        </p>
        <p className="text-nate-grey-500 mb-8">You can try again from your cart.</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/cart"
            className="inline-block bg-nate-grey-800 text-white px-8 py-4 rounded-lg hover:bg-nate-grey-700 transition-colors"
          >
            Back to Cart
          </Link>
          <Link
            href="/contact"
            className="inline-block border border-nate-grey-300 text-nate-grey-700 px-8 py-4 rounded-lg hover:bg-nate-grey-100 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

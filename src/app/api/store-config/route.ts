import { NextResponse } from "next/server";
import { isCodEnabled, getPartialPaymentConfig } from "@/lib/store-settings";

// Public, non-sensitive storefront config (e.g. which payment options to show).
// Read by the checkout page to decide whether to offer Cash on Delivery and
// partial (advance) payment.
export const dynamic = "force-dynamic";

export async function GET() {
  const partial = await getPartialPaymentConfig();
  return NextResponse.json({
    codEnabled: await isCodEnabled(),
    partialPaymentEnabled: partial.enabled,
    partialPaymentPercent: partial.percent,
  });
}

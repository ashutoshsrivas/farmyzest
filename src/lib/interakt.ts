/**
 * Interakt WhatsApp Business API integration
 * Sends templated WhatsApp messages for order lifecycle notifications
 */

const INTERAKT_BASE_URL = "https://api.interakt.ai/v1/public/message/";
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY;

function getAuthHeader(): string {
  if (!INTERAKT_API_KEY) {
    console.warn("[Interakt] INTERAKT_API_KEY is not set in environment variables");
    return "";
  }
  // Basic auth: base64(API_KEY:)
  const credentials = Buffer.from(`${INTERAKT_API_KEY}:`).toString("base64");
  return `Basic ${credentials}`;
}

export interface InteraktOrderData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  itemCount: number;
  createdAt?: Date;
}

/**
 * Core function to send a WhatsApp message via Interakt.
 * phone should be a full number with country code, e.g. "+919876543210"
 * or a 10-digit Indian local number (will be prefixed with +91).
 */
export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<void> {
  if (!phone || !message) {
    console.warn("[Interakt] Missing phone or message — skipping");
    return;
  }

  const auth = getAuthHeader();
  if (!auth) return;

  // Normalize phone to E.164-without-leading-plus.
  //
  // Accepted inputs we've seen in the wild:
  //   "9876543210"        → 10-digit Indian local
  //   "09876543210"       → 11-digit with carrier-network leading 0
  //   "919876543210"      → 12-digit with country code, no plus
  //   "+919876543210"     → standard E.164
  //   "+91 98765 43210"   → human-formatted with spaces
  //
  // 1. Strip everything except digits.
  // 2. Drop a single leading "0" (Indian local-call prefix that some users
  //    type out of habit — Interakt rejects it).
  // 3. If the result is 10 digits, assume India and prefix "91".
  //    Otherwise leave it alone — the digits already include a country code.
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;

  try {
    const response = await fetch(INTERAKT_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        phone_number: `+${normalizedPhone}`,
        countryCode: "+91",
        type: "Template",
        template: {
          name: "farmyzest_order",
          language: { code: "en" },
          body: {
            text: message,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Interakt] HTTP ${response.status}: ${errorBody}`);
    } else {
      console.log(`[Interakt] Message sent to +${normalizedPhone}`);
    }
  } catch (err) {
    console.error("[Interakt] Failed to send message:", err);
  }
}

/**
 * Sends order placed / confirmation message to customer
 */
export async function sendOrderConfirmation(
  order: InteraktOrderData
): Promise<void> {
  const message =
    `Hi ${order.customerName}! Your Farmyzest order #${order.orderNumber} ` +
    `has been placed successfully.\n\n` +
    `Order Total: ₹${order.total.toLocaleString("en-IN")}\n` +
    `Items: ${order.itemCount}\n\n` +
    `We'll notify you when your order ships! Track at farmyzest.com/track`;

  await sendWhatsApp(order.customerPhone, message);
}

/**
 * Sends shipping update with tracking number and courier info
 */
export async function sendShippingUpdate(
  order: InteraktOrderData,
  trackingNumber: string,
  courier: string
): Promise<void> {
  const trackingUrl = `https://farmyzest.com/track?code=${trackingNumber}`;
  const message =
    `Hi ${order.customerName}! Your Farmyzest order #${order.orderNumber} ` +
    `has been shipped via ${courier}.\n\n` +
    `Tracking Number: ${trackingNumber}\n` +
    `Track: ${trackingUrl}`;

  await sendWhatsApp(order.customerPhone, message);
}

/**
 * Sends delivery confirmation message
 */
export async function sendDeliveryConfirmation(
  order: InteraktOrderData
): Promise<void> {
  const message =
    `Hi ${order.customerName}! Great news — your Farmyzest order #${order.orderNumber} ` +
    `has been delivered!\n\n` +
    `We hope you love it! Leave a review and earn loyalty points.\n` +
    `Thank you for shopping with Farmyzest!`;

  await sendWhatsApp(order.customerPhone, message);
}
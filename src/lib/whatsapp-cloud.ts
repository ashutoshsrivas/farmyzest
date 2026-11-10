/**
 * Meta WhatsApp Cloud API sender (graph.facebook.com — the developers.facebook.com
 * "WhatsApp" product, not Interakt/Twilio).
 *
 * Business-initiated messages (order confirms, status updates, login OTP) MUST use
 * pre-approved message TEMPLATES. This module exposes a generic sendTemplate() plus
 * typed helpers for the order lifecycle, the admin new-order alert, and login OTP.
 * Everything fails soft — a WhatsApp failure must never break checkout, admin, or
 * login flows.
 *
 * Required env:
 *   WHATSAPP_TOKEN             Permanent System-User access token (NOT the 24h test token)
 *   WHATSAPP_PHONE_NUMBER_ID   The sending number's Phone Number ID (WhatsApp → API Setup)
 * Optional env:
 *   WHATSAPP_API_VERSION       Graph API version           (default v21.0)
 *   WHATSAPP_TEMPLATE_LANG     Template language code       (default en)
 *   WHATSAPP_DEFAULT_CC        Country code for bare 10-digit numbers (default 91)
 *   WHATSAPP_ADMIN_TO          Store's own WhatsApp number for new-order alerts
 *   WA_TPL_ORDER_CONFIRM       Template name (default order_confirmation)
 *   WA_TPL_ORDER_UPDATE        Template name (default order_update)
 *   WA_TPL_OTP                 Template name (default login_otp)     [AUTHENTICATION]
 *   WA_TPL_ADMIN_ORDER         Template name (default admin_new_order)
 */

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en";
const DEFAULT_CC = (process.env.WHATSAPP_DEFAULT_CC || "91").replace(/\D/g, "");
const ADMIN_TO = process.env.WHATSAPP_ADMIN_TO;

const TPL = {
  orderConfirm: process.env.WA_TPL_ORDER_CONFIRM || "order_confirmation",
  orderUpdate: process.env.WA_TPL_ORDER_UPDATE || "order_update",
  otp: process.env.WA_TPL_OTP || "login_otp",
  adminOrder: process.env.WA_TPL_ADMIN_ORDER || "admin_new_order",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** True when the Cloud API is configured (token + phone number id present). */
export function isWhatsAppConfigured(): boolean {
  return Boolean(TOKEN && PHONE_NUMBER_ID);
}

/**
 * Normalize a phone into Meta's wa_id form: pure digits, no '+', with a country
 * code. Bare 10-digit Indian numbers get DEFAULT_CC prepended; a leading trunk
 * "0" is stripped; anything already carrying a country code is used as-is.
 * Returns null when the result can't be a valid international number.
 */
export function toWaNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = DEFAULT_CC + d;
  else if (d.length === 11 && d.startsWith("0")) d = DEFAULT_CC + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? d : null;
}

interface TemplateOpts {
  /** Ordered {{1}}, {{2}}, … body variables. */
  bodyParams?: string[];
  /** For AUTHENTICATION templates: the code, echoed into the copy-code button. */
  buttonOtp?: string;
}

/** Low-level: send one approved template. Returns true on a 2xx from Graph. */
export async function sendTemplate(
  to: string | null | undefined,
  template: string,
  { bodyParams = [], buttonOtp }: TemplateOpts = {},
): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false;
  const waTo = toWaNumber(to);
  if (!waTo) return false;

  const components: unknown[] = [];
  if (bodyParams.length) {
    components.push({
      type: "body",
      parameters: bodyParams.map((t) => ({ type: "text", text: String(t) })),
    });
  }
  if (buttonOtp) {
    // Meta AUTHENTICATION template copy-code button (index 0).
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: String(buttonOtp) }],
    });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: waTo,
        type: "template",
        template: {
          name: template,
          language: { code: LANG },
          ...(components.length ? { components } : {}),
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[WhatsApp] ${template} → ${waTo} failed (${res.status}): ${errText.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] send error:", err);
    return false;
  }
}

// ── Typed helpers ────────────────────────────────────────────────────────────

/** order_confirmation body vars: {{1}} name, {{2}} order #, {{3}} total, {{4}} item count. */
export async function waOrderConfirmation(
  phone: string | null | undefined,
  o: { customerName: string; orderNumber: string; total: number; itemCount: number },
): Promise<boolean> {
  return sendTemplate(phone, TPL.orderConfirm, {
    bodyParams: [o.customerName, o.orderNumber, inr(o.total), String(o.itemCount)],
  });
}

/** order_update body vars: {{1}} name, {{2}} order #, {{3}} update text. */
export async function waOrderUpdate(
  phone: string | null | undefined,
  o: { customerName: string; orderNumber: string; updateText: string },
): Promise<boolean> {
  return sendTemplate(phone, TPL.orderUpdate, {
    bodyParams: [o.customerName, o.orderNumber, o.updateText],
  });
}

/** admin_new_order body vars: {{1}} order #, {{2}} customer, {{3}} total. Sent to WHATSAPP_ADMIN_TO. */
export async function waAdminNewOrder(o: {
  orderNumber: string;
  customer: string;
  total: number;
}): Promise<boolean> {
  if (!ADMIN_TO) return false;
  return sendTemplate(ADMIN_TO, TPL.adminOrder, {
    bodyParams: [o.orderNumber, o.customer, inr(o.total)],
  });
}

/** login_otp (AUTHENTICATION) body var {{1}} = code; copy-code button also carries the code. */
export async function waLoginOtp(phone: string | null | undefined, code: string): Promise<boolean> {
  return sendTemplate(phone, TPL.otp, { bodyParams: [code], buttonOtp: code });
}

// The PDF-document invoice + loyalty message are implemented on the Twilio
// provider (Content media/templates). No Meta equivalents are configured, so
// these are no-ops here to keep the provider surface uniform.
export async function waInvoiceDocument(
  _phone: string | null | undefined,
  _o: { customerName: string; orderNumber: string; total: string; pdfUrl: string },
): Promise<boolean> {
  return false;
}
export async function waLoyaltyPoints(
  _phone: string | null | undefined,
  _o: { customerName: string; points: string },
): Promise<boolean> {
  return false;
}

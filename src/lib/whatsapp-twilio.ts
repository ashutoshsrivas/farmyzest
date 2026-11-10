/**
 * Twilio WhatsApp sender — the Twilio-hosted path to the SAME WhatsApp Business
 * number, as an alternative to the direct Meta Cloud API in whatsapp-cloud.ts.
 * Selected at runtime by WHATSAPP_PROVIDER=twilio (see whatsapp-provider.ts).
 *
 * Business-initiated messages MUST use pre-approved templates. On Twilio a
 * template is a "Content" resource identified by a Content SID (HX…); the
 * ordered {{1}}, {{2}}, … variables are passed as ContentVariables. This module
 * mirrors whatsapp-cloud.ts's exports 1:1 so the two providers are drop-in
 * interchangeable, and everything fails soft — a WhatsApp failure must never
 * break checkout, admin, or login flows.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID          Account SID (AC…)
 *   TWILIO_AUTH_TOKEN           Auth Token (secret)
 *   TWILIO_WHATSAPP_FROM        Sending number, e.g. +917465030577 or whatsapp:+917465030577
 * Template Content SIDs (from Twilio Content Template Builder, once Meta-approved):
 *   TWILIO_CONTENT_ORDER_CONFIRM
 *   TWILIO_CONTENT_ORDER_UPDATE
 *   TWILIO_CONTENT_OTP          [AUTHENTICATION template]
 *   TWILIO_CONTENT_ADMIN_ORDER
 * Optional env (shared with the Meta client):
 *   WHATSAPP_DEFAULT_CC         Country code for bare 10-digit numbers (default 91)
 *   WHATSAPP_ADMIN_TO           Store's own WhatsApp number for new-order alerts
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DEFAULT_CC = (process.env.WHATSAPP_DEFAULT_CC || "91").replace(/\D/g, "");
const ADMIN_TO = process.env.WHATSAPP_ADMIN_TO;

/** Normalise the configured sender to Twilio's `whatsapp:+E164` form. */
function fromAddress(): string | null {
  const raw = process.env.TWILIO_WHATSAPP_FROM;
  if (!raw) return null;
  if (raw.startsWith("whatsapp:")) return raw;
  const d = raw.replace(/[^\d]/g, "");
  return d ? `whatsapp:+${d}` : null;
}

const CONTENT = {
  orderConfirm: process.env.TWILIO_CONTENT_ORDER_CONFIRM,
  orderUpdate: process.env.TWILIO_CONTENT_ORDER_UPDATE,
  otp: process.env.TWILIO_CONTENT_OTP,
  adminOrder: process.env.TWILIO_CONTENT_ADMIN_ORDER,
  invoiceDoc: process.env.TWILIO_CONTENT_INVOICE_DOC,
  loyalty: process.env.TWILIO_CONTENT_LOYALTY,
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** True when Twilio is configured (SID + auth token + a sending number). */
export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && fromAddress());
}

/**
 * Normalise a phone into Twilio's `whatsapp:+E164` recipient form. Bare 10-digit
 * Indian numbers get DEFAULT_CC prepended; a leading trunk "0" is stripped;
 * anything already carrying a country code is used as-is. Returns null when the
 * result can't be a valid international number.
 */
export function toWaNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = DEFAULT_CC + d;
  else if (d.length === 11 && d.startsWith("0")) d = DEFAULT_CC + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? `whatsapp:+${d}` : null;
}

/** Ordered {{1}}, {{2}}, … → Twilio's ContentVariables JSON ({"1":…,"2":…}). */
function contentVariables(bodyParams: string[]): string {
  const obj: Record<string, string> = {};
  bodyParams.forEach((v, i) => (obj[String(i + 1)] = String(v)));
  return JSON.stringify(obj);
}

/**
 * Low-level: send one approved Content template. `contentSid` is the HX… id of a
 * Twilio Content template; `bodyParams` fill its {{1}}, {{2}}, … in order.
 * Returns true on a 2xx from Twilio.
 */
export async function sendContent(
  to: string | null | undefined,
  contentSid: string | undefined,
  bodyParams: string[] = [],
): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false;
  const from = fromAddress();
  const waTo = toWaNumber(to);
  if (!from || !waTo) return false;
  if (!contentSid) {
    console.error("[WhatsApp/Twilio] missing Content SID for a template — skipped");
    return false;
  }

  const form = new URLSearchParams({ From: from, To: waTo, ContentSid: contentSid });
  if (bodyParams.length) form.set("ContentVariables", contentVariables(bodyParams));

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          // Basic auth: base64("AccountSid:AuthToken").
          Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[WhatsApp/Twilio] ${contentSid} → ${waTo} failed (${res.status}): ${errText.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp/Twilio] send error:", err);
    return false;
  }
}

// ── Typed helpers (same shape/param order as whatsapp-cloud.ts) ───────────────

/** order confirmation vars: {{1}} name, {{2}} order #, {{3}} total, {{4}} item count. */
export async function waOrderConfirmation(
  phone: string | null | undefined,
  o: { customerName: string; orderNumber: string; total: number; itemCount: number },
): Promise<boolean> {
  return sendContent(phone, CONTENT.orderConfirm, [
    o.customerName,
    o.orderNumber,
    inr(o.total),
    String(o.itemCount),
  ]);
}

/** order update vars: {{1}} name, {{2}} order #, {{3}} update text. */
export async function waOrderUpdate(
  phone: string | null | undefined,
  o: { customerName: string; orderNumber: string; updateText: string },
): Promise<boolean> {
  return sendContent(phone, CONTENT.orderUpdate, [o.customerName, o.orderNumber, o.updateText]);
}

/** admin new-order vars: {{1}} order #, {{2}} customer, {{3}} total. Sent to WHATSAPP_ADMIN_TO. */
export async function waAdminNewOrder(o: {
  orderNumber: string;
  customer: string;
  total: number;
}): Promise<boolean> {
  if (!ADMIN_TO) return false;
  return sendContent(ADMIN_TO, CONTENT.adminOrder, [o.orderNumber, o.customer, inr(o.total)]);
}

/** login OTP (AUTHENTICATION template): {{1}} = code (Twilio fills the copy-code button from it). */
export async function waLoginOtp(phone: string | null | undefined, code: string): Promise<boolean> {
  return sendContent(phone, CONTENT.otp, [code]);
}

/**
 * Invoice document: PDF bill sent as a WhatsApp document. The template's media
 * header pulls the PDF from {{4}} (a public URL); body vars {{1}}name {{2}}order#
 * {{3}}total. `total` is a pre-formatted string (e.g. "Rs. 9,036.45").
 */
export async function waInvoiceDocument(
  phone: string | null | undefined,
  o: { customerName: string; orderNumber: string; total: string; pdfUrl: string },
): Promise<boolean> {
  return sendContent(phone, CONTENT.invoiceDoc, [o.customerName, o.orderNumber, o.total, o.pdfUrl]);
}

/** Loyalty reminder: {{1}} name, {{2}} points balance (string). */
export async function waLoyaltyPoints(
  phone: string | null | undefined,
  o: { customerName: string; points: string },
): Promise<boolean> {
  return sendContent(phone, CONTENT.loyalty, [o.customerName, o.points]);
}

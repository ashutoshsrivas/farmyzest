/**
 * Twilio Verify — phone OTP delivery for login, over SMS (default) or WhatsApp.
 *
 * Unlike a raw SMS/WhatsApp send, Verify needs NO owned number and NO approved
 * template: Twilio generates the code, delivers it on its managed global pool
 * (India-compliant), and we just check it back. This is how the store gets an
 * SMS/WhatsApp login code without a DLT-registered sender or a Meta-approved
 * authentication template. Email OTP (our own code, see otp.ts) stays the
 * primary/fallback channel; this is layered on top and fails soft.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID          Account SID (AC…)
 *   TWILIO_AUTH_TOKEN           Auth Token (secret)
 *   TWILIO_VERIFY_SERVICE_SID   Verify Service SID (VA…)
 * Optional env:
 *   TWILIO_VERIFY_CHANNEL       sms | whatsapp | call   (default sms)
 *   WHATSAPP_DEFAULT_CC         Country code for bare 10-digit numbers (default 91)
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const CHANNEL = (process.env.TWILIO_VERIFY_CHANNEL || "sms").trim().toLowerCase();
const DEFAULT_CC = (process.env.WHATSAPP_DEFAULT_CC || "91").replace(/\D/g, "");

/** True when Verify is configured (SID + token + service). */
export function isVerifyConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && VERIFY_SID);
}

/** Normalise a phone to +E164. Bare 10-digit → +DEFAULT_CC; trunk 0 stripped. */
function toE164(phone?: string | null): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = DEFAULT_CC + d;
  else if (d.length === 11 && d.startsWith("0")) d = DEFAULT_CC + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? `+${d}` : null;
}

const authHeader = () =>
  `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`;

/** Start a verification — Twilio sends a fresh code to `phone` over `channel`. */
export async function startPhoneOtp(
  phone: string | null | undefined,
  channel: string = CHANNEL,
): Promise<boolean> {
  if (!isVerifyConfigured()) return false;
  const to = toE164(phone);
  if (!to) return false;
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, Channel: channel }).toString(),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error(`[Verify] start ${channel} → ${to} failed (${res.status}): ${t.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Verify] start error:", err);
    return false;
  }
}

/** Check a code the user entered. True only when Twilio reports "approved". */
export async function checkPhoneOtp(
  phone: string | null | undefined,
  code: string,
): Promise<boolean> {
  if (!isVerifyConfigured()) return false;
  const to = toE164(phone);
  if (!to || !code) return false;
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, Code: String(code) }).toString(),
    });
    if (!res.ok) return false; // 404 = no pending verification / already consumed
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    return data.status === "approved";
  } catch (err) {
    console.error("[Verify] check error:", err);
    return false;
  }
}

// Self-managed login OTP, delivered by email (SMTP). We generate the code,
// store only its hash (short expiry + attempt cap), send it, and verify it
// ourselves — single use.

import { createHash } from "crypto";
import { db } from "./db";
import { sendEmail, otpEmail, isEmailConfigured } from "./email";
import { isWhatsAppConfigured, waLoginOtp } from "./whatsapp-provider";
import { isVerifyConfigured, startPhoneOtp, checkPhoneOtp } from "./twilio-verify";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/** Lowercase + trim an email so storage/lookup is consistent. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  // Minimal shape check — good enough to avoid sending to garbage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

function hash(identifier: string, code: string): string {
  return createHash("sha256").update(`${identifier}:${code}`).digest("hex");
}

/** True when email (and therefore OTP login) is configured. */
export function isOtpConfigured(): boolean {
  return isEmailConfigured();
}

/** Generate + email a fresh OTP for `email`. Fails soft. */
export async function startEmailOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  const id = normalizeEmail(email);
  if (!id) return { ok: false, error: "invalid_email" };
  if (!isEmailConfigured()) return { ok: false, error: "not_configured" };

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // One active code per identifier — clear any previous, then store the hash.
  await db.loginOtp.deleteMany({ where: { identifier: id } });
  await db.loginOtp.create({ data: { identifier: id, codeHash: hash(id, code), expiresAt } });

  const { subject, html } = otpEmail(code);
  const sent = await sendEmail({ to: id, subject, html });
  if (!sent) {
    await db.loginOtp.deleteMany({ where: { identifier: id } });
    return { ok: false, error: "send_failed" };
  }

  // Also deliver a code to the account's phone, so the user can log in from
  // email OR phone. Supplementary + fails soft — email stays primary.
  //  • Twilio Verify (SMS / WhatsApp): Twilio generates & sends its OWN code and
  //    verifies it back (no owned number / approved template needed). Preferred.
  //  • WhatsApp template (waLoginOtp): sends OUR `code`; only fires if a Meta
  //    AUTHENTICATION template is configured (needs business verification).
  // Verify's code differs from the emailed code — verifyOtp() accepts either.
  if (isVerifyConfigured() || isWhatsAppConfigured()) {
    try {
      const user = await db.user.findFirst({ where: { email: id }, select: { phone: true } });
      if (user?.phone) {
        if (isVerifyConfigured()) await startPhoneOtp(user.phone);
        else if (isWhatsAppConfigured()) await waLoginOtp(user.phone, code);
      }
    } catch (err) {
      console.error("[OTP] phone-channel send failed:", err);
    }
  }

  return { ok: true };
}

/**
 * Verify `code` for `identifier`. Accepts EITHER the emailed code (our own,
 * hash-checked locally) OR the phone code delivered via Twilio Verify (SMS /
 * WhatsApp — a different code, checked with Twilio). True on the first match.
 */
export async function verifyOtp(identifier: string, code: string): Promise<boolean> {
  const id = normalizeEmail(identifier);
  if (!id || !code) return false;

  // 1) Locally-issued emailed code.
  const rec = await db.loginOtp.findFirst({ where: { identifier: id }, orderBy: { createdAt: "desc" } });
  if (
    rec &&
    rec.expiresAt >= new Date() &&
    rec.attempts < MAX_ATTEMPTS &&
    hash(id, String(code)) === rec.codeHash
  ) {
    await db.loginOtp.deleteMany({ where: { identifier: id } });
    return true;
  }

  // 2) Phone code via Twilio Verify (Twilio bounds its own attempts). Only the
  //    account's stored phone can satisfy it — the entered email picks the user.
  if (isVerifyConfigured()) {
    const user = await db.user.findFirst({ where: { email: id }, select: { phone: true } });
    if (user?.phone && (await checkPhoneOtp(user.phone, code))) {
      await db.loginOtp.deleteMany({ where: { identifier: id } });
      return true;
    }
  }

  // 3) Neither matched — count a failed attempt against the local code so email
  //    brute force stays bounded; drop it once expired or over the cap.
  if (rec) {
    if (rec.expiresAt < new Date() || rec.attempts + 1 >= MAX_ATTEMPTS) {
      await db.loginOtp.deleteMany({ where: { identifier: id } });
    } else {
      await db.loginOtp.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    }
  }
  return false;
}

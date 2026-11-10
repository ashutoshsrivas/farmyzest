// SMTP email — the channel for login OTPs and order notifications (replaces
// SMS for customer comms; email is now the primary identifier).
//
// All sends fail soft (log + return false) so an outage never breaks login or
// checkout. Env it reads:
//   SMTP_HOST              e.g. email-smtp.ap-south-1.amazonaws.com / smtp.zoho.in
//   SMTP_PORT              587 (STARTTLS) or 465 (SSL). Default 587.
//   SMTP_SECURE            "1" to force TLS-on-connect (port 465).
//   SMTP_USER, SMTP_PASS   SMTP credentials.
//   SMTP_FROM              From header, e.g. "Farmyzest <no-reply@farmyzest.com>".

import nodemailer, { type Transporter } from "nodemailer";

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT || 587);
const SECURE = process.env.SMTP_SECURE === "1" || PORT === 465;
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const FROM = process.env.SMTP_FROM || "Farmyzest <no-reply@farmyzest.com>";
const REPLY_TO = process.env.SMTP_REPLY_TO;

let transporter: Transporter | null = null;
function getTransport(): Transporter | null {
  if (!HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      ...(USER && PASS ? { auth: { user: USER, pass: PASS } } : {}),
    });
  }
  return transporter;
}

/** True when SMTP is configured enough to send. */
export function isEmailConfigured(): boolean {
  return !!HOST && !!FROM;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | Uint8Array;
  contentType?: string;
}

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/** Send an email. Returns false if not configured or on error. */
export async function sendEmail({ to, subject, html, text, attachments }: SendEmailOpts): Promise<boolean> {
  const tx = getTransport();
  if (!tx) {
    console.warn("[Email] SMTP not configured (SMTP_HOST missing)");
    return false;
  }
  try {
    await tx.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: text ?? stripHtml(html),
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      ...(attachments?.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
              contentType: a.contentType ?? "application/octet-stream",
            })),
          }
        : {}),
    });
    return true;
  } catch (e) {
    console.error("[Email] send failed", e);
    return false;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Branded wrapper ──────────────────────────────────────────────────────────

/** Minimal, email-client-safe HTML shell around the message body. */
export function emailLayout(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F4F1E8;font-family:Helvetica,Arial,sans-serif;color:#2F3A2B;">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E7E1D0;">
      <div style="padding:24px 28px;border-bottom:1px solid #efeee9;text-align:center;">
        <div style="font-size:22px;letter-spacing:.5px;color:#1F2E22;">Farmyzest</div>
      </div>
      <div style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</div>
      <div style="padding:18px 28px;border-top:1px solid #efeee9;color:#A89F86;font-size:12px;text-align:center;">
        © Farmyzest
      </div>
    </div>
  </div></body></html>`;
}

/** OTP verification email. */
export function otpEmail(code: string): { subject: string; html: string } {
  return {
    subject: `${code} is your Farmyzest login code`,
    html: emailLayout(
      `<p>Use this code to sign in:</p>
       <div style="font-size:30px;letter-spacing:8px;font-weight:600;text-align:center;margin:18px 0;color:#1F2E22;">${code}</div>
       <p style="color:#7C735C;font-size:13px;">Valid for 10 minutes. If you didn't request this, you can ignore this email.</p>`
    ),
  };
}

// AWS SNS transactional SMS — replaces Twilio for OTP login and order
// notifications. Uses the same AWS credentials/region as S3 (env or profile).
//
// All sends fail soft (log + return false) so a messaging outage never breaks
// checkout or login. Env it reads:
//   AWS_REGION (default ap-south-1), AWS_PROFILE (optional)
//   SNS_SENDER_ID        — alphanumeric sender header (India: must be a
//                          DLT-registered 6-char header, e.g. "STYLST")
//   SNS_SMS_ENTITY_ID    — India DLT principal-entity id (optional)
//   SMS_DISABLED=1       — kill switch
//
// NOTE on India: delivery to Indian numbers requires TRAI/DLT registration
// (registered sender header + per-message template ids). Without it, AWS will
// accept the publish but the carrier drops the message. Pass a registered
// template id via `opts.templateId` once you have one.

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { fromIni } from "@aws-sdk/credential-providers";

const REGION = process.env.AWS_REGION || "ap-south-1";
const SENDER_ID = process.env.SNS_SENDER_ID;
const ENTITY_ID = process.env.SNS_SMS_ENTITY_ID;

const sns = new SNSClient({
  region: REGION,
  ...(process.env.AWS_PROFILE ? { credentials: fromIni({ profile: process.env.AWS_PROFILE }) } : {}),
});

/**
 * Normalise a phone to E.164 (with leading +). 10 digits → assumed India (+91).
 * Already-prefixed numbers pass through. Returns null if it can't be made sane.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return "+" + digits;
}

/** True when AWS credentials are available and SMS isn't switched off. */
export function isSmsConfigured(): boolean {
  if (process.env.SMS_DISABLED === "1") return false;
  return (
    !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    !!process.env.AWS_PROFILE
  );
}

interface SendSmsOpts {
  /** India DLT registered template id for this message, if you have one. */
  templateId?: string;
}

/** Send a transactional SMS. Returns false if not configured or on error. */
export async function sendSms(phone: string, message: string, opts: SendSmsOpts = {}): Promise<boolean> {
  const to = toE164(phone);
  if (!to) return false;
  if (!isSmsConfigured()) {
    console.warn("[SNS] SMS not configured (AWS credentials missing)");
    return false;
  }

  const attrs: Record<string, { DataType: string; StringValue: string }> = {
    "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
  };
  if (SENDER_ID) attrs["AWS.SNS.SMS.SenderID"] = { DataType: "String", StringValue: SENDER_ID };
  if (ENTITY_ID) attrs["AWS.MM.SMS.EntityId"] = { DataType: "String", StringValue: ENTITY_ID };
  if (opts.templateId) attrs["AWS.MM.SMS.TemplateId"] = { DataType: "String", StringValue: opts.templateId };

  try {
    await sns.send(new PublishCommand({ PhoneNumber: to, Message: message, MessageAttributes: attrs }));
    return true;
  } catch (e) {
    console.error("[SNS] send failed", e);
    return false;
  }
}

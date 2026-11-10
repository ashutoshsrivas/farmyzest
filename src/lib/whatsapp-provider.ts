/**
 * WhatsApp provider selector. Both providers talk to the SAME WhatsApp Business
 * number; this just picks which pipe to send through, chosen once at boot by:
 *
 *   WHATSAPP_PROVIDER = "twilio"   → src/lib/whatsapp-twilio.ts
 *   WHATSAPP_PROVIDER = "meta"     → src/lib/whatsapp-cloud.ts   (default)
 *
 * Both modules expose the identical surface (isWhatsAppConfigured + the four
 * typed helpers), so callers import from here and never care which is active.
 * Unset / unknown value falls back to Meta, keeping existing deployments intact.
 */
import * as meta from "./whatsapp-cloud";
import * as twilio from "./whatsapp-twilio";

const provider = (process.env.WHATSAPP_PROVIDER || "meta").trim().toLowerCase() === "twilio" ? twilio : meta;

export const isWhatsAppConfigured = provider.isWhatsAppConfigured;
export const waOrderConfirmation = provider.waOrderConfirmation;
export const waOrderUpdate = provider.waOrderUpdate;
export const waAdminNewOrder = provider.waAdminNewOrder;
export const waLoginOtp = provider.waLoginOtp;
export const waInvoiceDocument = provider.waInvoiceDocument;
export const waLoyaltyPoints = provider.waLoyaltyPoints;

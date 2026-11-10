// Deliver an order's tax-invoice PDF to the customer — email attachment +
// WhatsApp document. Everything fails soft: bill delivery must NEVER break order
// creation or payment. Call fire-and-forget after an order is finalised.

import { db } from "@/lib/db";
import { buildOrderInvoice } from "@/lib/order-invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { readStoreSettings } from "@/lib/store-settings";
import { uploadToS3 } from "@/lib/s3";
import { sendEmail, emailLayout } from "@/lib/email";
import { isWhatsAppConfigured, waInvoiceDocument } from "@/lib/whatsapp-provider";
import { COMPANY_NAME, COMPANY_GSTIN, STORE_ADDRESS, STORE_EMAIL, STORE_PHONE } from "@/lib/company";

const money = (n: number) =>
  "Rs. " + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Fetch an order and render its tax-invoice PDF. Returns null if missing. */
export async function buildOrderInvoicePdf(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true } } },
  });
  if (!order) return null;

  const settings = await readStoreSettings().catch(
    () => ({}) as Awaited<ReturnType<typeof readStoreSettings>>,
  );
  const defaultGstRate = settings.defaultGstRate ?? 5;
  // Online orders show each line's current auto-tier %; POS bills show the
  // discount actually rung. See src/lib/order-invoice.ts.
  const inv = await buildOrderInvoice(order, defaultGstRate);

  const invoiceNo = order.posOrderNum ?? order.id.slice(-8).toUpperCase();
  const dateStr = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const bytes = await renderInvoicePdf({
    storeName: settings.storeName || "Farmyzest",
    companyName: COMPANY_NAME,
    address: settings.storeAddress || STORE_ADDRESS,
    gstin: settings.gstNumber || COMPANY_GSTIN,
    email: settings.storeEmail || STORE_EMAIL,
    phone: settings.storePhone || STORE_PHONE,
    invoiceNo,
    dateStr,
    sourceLabel: order.source === "POS" ? "In-store (POS)" : "Online",
    paymentLabel: `${order.paymentMethod ?? ""} · ${order.paymentStatus ?? ""}`.replace(/^\s*·\s*/, "").trim(),
    customerName: order.billingName || order.shippingName || "Walk-in customer",
    customerPhone: order.billingPhone || order.shippingPhone || "",
    inv,
    loyaltyDiscount: order.loyaltyDiscount ?? 0,
    pointsRedeemed: order.pointsRedeemed ?? 0,
  });

  return { bytes, filename: `Invoice-${invoiceNo}.pdf`, invoiceNo, order };
}

/**
 * Generate + deliver an order's invoice PDF over email (attachment) and WhatsApp
 * (document). Safe to call fire-and-forget; never throws. Returns which channels
 * actually sent.
 */
export async function sendOrderBill(orderId: string): Promise<{ email: boolean; whatsapp: boolean }> {
  const result = { email: false, whatsapp: false };
  const built = await buildOrderInvoicePdf(orderId).catch((err) => {
    console.error("[Bill] PDF build failed:", err);
    return null;
  });
  if (!built) return result;
  const { bytes, filename, invoiceNo, order } = built;

  const name = order.billingName || order.shippingName || "there";
  const total = money(order.total);

  // Upload to S3 so WhatsApp can fetch the document from a public URL.
  let pdfUrl: string | null = null;
  try {
    pdfUrl = await uploadToS3({ key: `invoices/${order.id}.pdf`, body: Buffer.from(bytes), contentType: "application/pdf" });
  } catch (err) {
    console.error("[Bill] S3 upload failed:", err);
  }

  // Email with the PDF attached.
  const to = order.billingEmail || order.user?.email || null;
  if (to) {
    result.email = await sendEmail({
      to,
      subject: `Your Farmyzest invoice ${invoiceNo}`,
      html: emailLayout(
        `<p>Hi ${escapeHtml(name)},</p>
         <p>Thank you for your purchase! Your tax invoice <strong>${escapeHtml(invoiceNo)}</strong> (total ${total}) is attached as a PDF.</p>
         <p style="color:#7C735C;font-size:13px;">Please keep it for any exchange within our return window.</p>`,
      ),
      attachments: [{ filename, content: bytes, contentType: "application/pdf" }],
    });
  }

  // WhatsApp document (needs a public PDF URL + a phone).
  const phone = order.billingPhone || order.shippingPhone || null;
  if (isWhatsAppConfigured() && phone && pdfUrl) {
    result.whatsapp = await waInvoiceDocument(phone, {
      customerName: name,
      orderNumber: invoiceNo,
      total,
      pdfUrl,
    });
  }

  return result;
}

/**
 * Order-lifecycle customer notifications, sent as EMAIL (SMTP).
 *
 * (The file keeps its historical name and exports so call sites — online order,
 * POS order, admin status change — change only their first argument from phone
 * to email.)
 *
 * Call these after order creation / status changes. They NEVER throw — a
 * messaging failure must not break checkout or admin flows. On a new order we
 * also send an internal copy to ADMIN_NOTIFY_EMAIL when set.
 */

import { sendEmail, emailLayout } from "./email";
import {
  isWhatsAppConfigured,
  waOrderConfirmation,
  waOrderUpdate,
  waAdminNewOrder,
} from "./whatsapp-provider";

export interface OrderNotifyData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  total: number;
  itemCount: number;
  createdAt?: Date;
}
// Back-compat alias for older imports.
export type InteraktOrderData = OrderNotifyData;

export type OrderStatusTrigger = "PLACED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";

interface NotifyOrderOptions {
  email: string;
  order: OrderNotifyData;
  trigger: OrderStatusTrigger;
  trackingNumber?: string;
  courier?: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ADMIN_NOTIFY = process.env.ADMIN_NOTIFY_EMAIL;

// Public base for shareable receipt links. Overridable with RECEIPT_BASE_URL.
const RECEIPT_BASE = (process.env.RECEIPT_BASE_URL || "https://farmyzest.com").replace(/\/$/, "");
export const receiptUrl = (orderId: string) => `${RECEIPT_BASE}/receipt/${orderId}`;

export async function notifyOrderStatus({
  email,
  order,
  trigger,
  trackingNumber,
  courier,
}: NotifyOrderOptions): Promise<void> {
  // ── Email channel (SMTP) — only when we have an address. ──
  if (email) {
    try {
      const { subject, html } = buildEmail(trigger, order, trackingNumber, courier);
      await sendEmail({ to: email, subject, html });
      // Internal alert to the store on a fresh order.
      if (trigger === "PLACED" && ADMIN_NOTIFY) {
        await sendEmail({
          to: ADMIN_NOTIFY,
          subject: `New order ${order.orderNumber} · ${inr(order.total)}`,
          html: emailLayout(
            `<p><strong>New order received.</strong></p>
             <p>Order <strong>#${order.orderNumber}</strong><br/>
             Customer: ${order.customerName}${order.customerPhone ? ` (${order.customerPhone})` : ""}<br/>
             Email: ${order.customerEmail ?? email}<br/>
             Items: ${order.itemCount} · Total: <strong>${inr(order.total)}</strong></p>
             <p><a href="${receiptUrl(order.orderId)}">View bill</a></p>`
          ),
        });
      }
    } catch (err) {
      console.error("[Email] order notify failed:", err);
    }
  }

  // ── WhatsApp channel (Meta Cloud API) — independent, keyed on the phone. ──
  if (isWhatsAppConfigured()) {
    try {
      const phone = order.customerPhone;
      if (phone) {
        if (trigger === "PLACED") {
          await waOrderConfirmation(phone, {
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            total: order.total,
            itemCount: order.itemCount,
          });
        } else {
          await waOrderUpdate(phone, {
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            updateText: waUpdateText(trigger, trackingNumber, courier),
          });
        }
      }
      // Store's own WhatsApp alert on a fresh order (independent of the customer).
      if (trigger === "PLACED") {
        await waAdminNewOrder({
          orderNumber: order.orderNumber,
          customer: `${order.customerName}${phone ? ` (${phone})` : ""}`,
          total: order.total,
        });
      }
    } catch (err) {
      console.error("[WhatsApp] order notify failed:", err);
    }
  }
}

// Human-readable status line for the generic order_update WhatsApp template.
function waUpdateText(trigger: OrderStatusTrigger, tracking?: string, courier?: string): string {
  switch (trigger) {
    case "SHIPPED":
      return `has shipped${
        courier || tracking ? ` via ${courier ?? "courier"}${tracking ? ` (${tracking})` : ""}` : ""
      }`;
    case "OUT_FOR_DELIVERY":
      return "is out for delivery today";
    case "DELIVERED":
      return "has been delivered";
    default:
      return "has a new update";
  }
}

function buildEmail(
  trigger: OrderStatusTrigger,
  o: OrderNotifyData,
  tracking?: string,
  courier?: string,
): { subject: string; html: string } {
  const receipt = receiptUrl(o.orderId);
  const cta = `<p style="margin-top:18px;"><a href="${receipt}" style="display:inline-block;background:#1F2E22;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;">View / download your bill</a></p>`;
  switch (trigger) {
    case "PLACED":
      return {
        subject: `Order #${o.orderNumber} confirmed · Farmyzest`,
        html: emailLayout(
          `<p>Hi ${o.customerName},</p>
           <p>Your order <strong>#${o.orderNumber}</strong> is confirmed.</p>
           <p>Total: <strong>${inr(o.total)}</strong> &nbsp;·&nbsp; ${o.itemCount} item(s)</p>
           ${cta}
           <p style="color:#7C735C;font-size:13px;margin-top:18px;">Thank you for shopping with Farmyzest.</p>`
        ),
      };
    case "SHIPPED":
      return {
        subject: `Order #${o.orderNumber} shipped · Farmyzest`,
        html: emailLayout(
          `<p>Good news ${o.customerName}!</p>
           <p>Order <strong>#${o.orderNumber}</strong> has shipped${
             courier || tracking ? ` via ${courier ?? "courier"}${tracking ? ` (${tracking})` : ""}` : ""
           }.</p>
           ${cta}`
        ),
      };
    case "OUT_FOR_DELIVERY":
      return {
        subject: `Order #${o.orderNumber} is out for delivery · Farmyzest`,
        html: emailLayout(
          `<p>Hi ${o.customerName},</p>
           <p>Order <strong>#${o.orderNumber}</strong> is out for delivery today. Please keep someone available to receive it.</p>${cta}`
        ),
      };
    case "DELIVERED":
      return {
        subject: `Order #${o.orderNumber} delivered · Farmyzest`,
        html: emailLayout(
          `<p>Order <strong>#${o.orderNumber}</strong> has been delivered.</p>
           <p>Thank you for shopping with Farmyzest, ${o.customerName}!</p>${cta}`
        ),
      };
  }
}

// ── Convenience helpers ──────────────────────────────────────────────────────

export async function notifyPosOrderPlaced(email: string, order: OrderNotifyData) {
  await notifyOrderStatus({ email, order, trigger: "PLACED" });
}
export async function notifyOnlineOrderPlaced(email: string, order: OrderNotifyData) {
  await notifyOrderStatus({ email, order, trigger: "PLACED" });
}
export async function notifyOrderShipped(email: string, order: OrderNotifyData, trackingNumber?: string, courier?: string) {
  await notifyOrderStatus({ email, order, trigger: "SHIPPED", trackingNumber, courier });
}
export async function notifyOrderDelivered(email: string, order: OrderNotifyData) {
  await notifyOrderStatus({ email, order, trigger: "DELIVERED" });
}

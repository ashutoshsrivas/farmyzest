// Server-side PDF tax invoice for an order — emailed as an attachment and sent
// as a WhatsApp document. Built with pdf-lib (pure JS: no Chromium, no native
// deps) so it's safe on the small standalone box and never blocks the build.
//
// Currency is written as "Rs." — pdf-lib's built-in Helvetica is WinAnsi and
// cannot encode the ₹ glyph (U+20B9); "Rs." keeps it dependency-free.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { type InvoiceComputation } from "@/lib/invoice";
import { RETURN_POLICY_TEXT } from "@/lib/company";

export interface InvoicePdfData {
  storeName: string;
  companyName: string;
  address: string;
  gstin: string;
  email: string;
  phone: string;
  invoiceNo: string;
  dateStr: string;
  sourceLabel: string; // "In-store (POS)" | "Online"
  paymentLabel: string; // "CASH · PAID"
  customerName: string;
  customerPhone: string;
  inv: InvoiceComputation;
  // ₹ of the bill-level discount that came from loyalty points, and how many
  // points, so the redemption shows as its own line. 0 = none.
  loyaltyDiscount?: number;
  pointsRedeemed?: number;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 40; // page margin
const INK = rgb(0.11, 0.1, 0.09);
const MUTE = rgb(0.45, 0.43, 0.4);
const LINE = rgb(0.85, 0.84, 0.82);

const money = (n: number) =>
  "Rs. " + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctStr = (n: number) => {
  const s = n.toFixed(1);
  return (s.endsWith(".0") ? s.slice(0, -2) : s) + "%";
};

/** Render an invoice to PDF bytes. Pure — no DB, so it's unit-testable. */
export async function renderInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Tax Invoice ${d.invoiceNo}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const rightText = (s: string, xRight: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color });
  const hline = (yy: number, color = LINE) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: A4.w - M, y: yy }, thickness: 0.8, color });

  // ── Header ──────────────────────────────────────────────────────────────
  text(d.storeName, M, y - 4, 22, bold);
  rightText("TAX INVOICE", A4.w - M, y - 2, 12, bold, MUTE);
  y -= 20;
  text(d.companyName, M, y - 4, 10, font, MUTE);
  rightText(d.invoiceNo, A4.w - M, y - 4, 12, bold);
  y -= 14;
  // wrap the address across up to 2 lines within the left half
  for (const ln of wrapText(d.address, font, 9, (A4.w - 2 * M) * 0.62)) {
    text(ln, M, y - 4, 9, font, MUTE);
    y -= 12;
  }
  const contact = [d.phone && `Ph: ${d.phone}`, d.email].filter(Boolean).join("   ·   ");
  if (contact) { text(contact, M, y - 4, 9, font, MUTE); y -= 12; }
  if (d.gstin) { text(`GSTIN: ${d.gstin}`, M, y - 4, 9, bold); y -= 12; }
  y -= 4;
  hline(y);
  y -= 16;

  // ── Bill-to + meta ──────────────────────────────────────────────────────
  text("BILL TO", M, y, 8, bold, MUTE);
  rightText(d.dateStr, A4.w - M, y, 9, font, MUTE);
  y -= 13;
  text(d.customerName || "Walk-in customer", M, y, 11, bold);
  rightText(`${d.sourceLabel}   ·   ${d.paymentLabel}`, A4.w - M, y, 9, font, MUTE);
  y -= 13;
  if (d.customerPhone) { text(d.customerPhone, M, y, 9, font, MUTE); y -= 13; }
  y -= 6;

  // ── Line-item table ─────────────────────────────────────────────────────
  const col = { idx: M, item: M + 22, qty: 330, rate: 405, disc: 475, amt: A4.w - M };
  const drawHead = () => {
    text("#", col.idx, y, 8, bold, MUTE);
    text("ITEM", col.item, y, 8, bold, MUTE);
    rightText("QTY", col.qty, y, 8, bold, MUTE);
    rightText("MRP", col.rate, y, 8, bold, MUTE);
    rightText("DISC", col.disc, y, 8, bold, MUTE);
    rightText("AMOUNT", col.amt, y, 8, bold, MUTE);
    y -= 6;
    hline(y);
    y -= 14;
  };
  drawHead();

  const ensureRoom = (need: number) => {
    if (y - need < 140) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
      drawHead();
    }
  };

  d.inv.lines.forEach((l, i) => {
    ensureRoom(28);
    const nameLines = wrapText(l.productName, font, 9, col.qty - col.item - 40);
    text(String(i + 1), col.idx, y, 9);
    text(nameLines[0], col.item, y, 9);
    rightText(String(l.quantity), col.qty, y, 9);
    rightText(money(l.listUnit).replace("Rs. ", ""), col.rate, y, 9);
    // Discount: % + amount, or "Special price"
    if (l.discount > 0) rightText(pctStr(l.discountPct), col.disc, y, 9);
    else if (l.isSpecialPrice) rightText("Spl.", col.disc, y, 8, font, MUTE);
    else rightText("-", col.disc, y, 9, font, MUTE);
    rightText(money(l.lineTotal).replace("Rs. ", ""), col.amt, y, 9);
    y -= 12;
    // extra wrapped name lines + variant
    const extra = [...nameLines.slice(1)];
    if (l.variantLabel) extra.push(l.variantLabel);
    for (const ex of extra) { text(ex, col.item, y, 8, font, MUTE); y -= 11; }
    y -= 2;
  });

  y -= 4;
  hline(y);
  y -= 18;

  // ── Totals (right column) ───────────────────────────────────────────────
  const t = d.inv.totals;
  const labelX = A4.w - M - 200;
  const row = (label: string, val: string, strong = false) => {
    text(label, labelX, y, strong ? 11 : 9, strong ? bold : font, strong ? INK : MUTE);
    rightText(val, A4.w - M, y, strong ? 12 : 9, strong ? bold : font, INK);
    y -= strong ? 18 : 14;
  };
  row("Subtotal (incl. GST)", money(t.grossSubtotal));
  if (t.lineDiscount > 0) row("Item discount", "- " + money(t.lineDiscount));
  // Split loyalty-points redemption out of the bill-level discount so it reads
  // clearly instead of looking like an unexplained extra discount.
  const loyalty = Math.min(d.loyaltyDiscount ?? 0, t.billDiscount);
  const otherBill = Math.round((t.billDiscount - loyalty) * 100) / 100;
  if (loyalty > 0)
    row(`Points redeemed${d.pointsRedeemed ? ` (${d.pointsRedeemed} pts)` : ""}`, "- " + money(loyalty));
  if (otherBill > 0) row("Bill discount", "- " + money(otherBill));
  if (t.taxableValue > 0) {
    row("Taxable value", money(t.taxableValue));
    if (t.cgst > 0) row("CGST", money(t.cgst));
    if (t.sgst > 0) row("SGST", money(t.sgst));
  }
  page.drawLine({ start: { x: labelX, y: y + 4 }, end: { x: A4.w - M, y: y + 4 }, thickness: 1.2, color: INK });
  y -= 8;
  row("Grand Total", money(t.grandTotal), true);

  // ── Footer ──────────────────────────────────────────────────────────────
  const fy = 70;
  page.drawLine({ start: { x: M, y: fy + 20 }, end: { x: A4.w - M, y: fy + 20 }, thickness: 0.8, color: LINE });
  text("Terms: " + RETURN_POLICY_TEXT, M, fy + 4, 8, font, MUTE);
  text("Prices are inclusive of GST.  Thank you for shopping with " + d.storeName + ".", M, fy - 8, 8, font, MUTE);

  return doc.save();
}

/** Break `s` into lines no wider than `maxW` at `size` in `font`. */
function wrapText(s: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = String(s || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxW) cur = trial;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

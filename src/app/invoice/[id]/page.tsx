// A5 GST tax invoice — proper CGST/SGST breakup + discount breakup, designed to
// print cleanly on an A5 sheet (and Save-as-PDF / share). Standalone top-level
// route, no storefront chrome. The order id is an unguessable cuid, so this is
// safe to expose without a login (same posture as /receipt/[id]).
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { hasBill } from "@/lib/order-status";
import { buildOrderInvoice } from "@/lib/order-invoice";
import { readStoreSettings } from "@/lib/store-settings";
import { COMPANY_NAME, COMPANY_GSTIN, SITE_URL, RETURN_POLICY_TEXT, STORE_ADDRESS, STORE_PHONE, STORE_EMAIL } from "@/lib/company";
import QRCode from "qrcode";
import { PrintButton } from "./PrintButton";
import { AutoPrint } from "./AutoPrint";

const inr = (n: number) =>
  "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Percentage without noisy trailing zeros: 10.00 → "10", 12.50 → "12.5".
const pct = (n: number) => {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};

// Indian-numbering amount in words (for the "Rupees … only" line).
function rupeesInWords(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`;
  const three = (x: number): string =>
    x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x);
  let words = "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n / 100000) % 100);
  const thousand = Math.floor((n / 1000) % 100);
  const hundred = n % 1000;
  if (crore) words += `${two(crore)} Crore `;
  if (lakh) words += `${two(lakh)} Lakh `;
  if (thousand) words += `${two(thousand)} Thousand `;
  if (hundred) words += three(hundred);
  return `${words.trim()} Rupees Only`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, select: { posOrderNum: true } });
  const num = order?.posOrderNum ?? id.slice(-8).toUpperCase();
  return { title: `Tax Invoice ${num} · Farmyzest`, robots: { index: false } };
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const { autoprint } = await searchParams;
  const [order, settings] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: {
        items: true,
        salesman: { select: { name: true } },
        attendedBy: { select: { name: true } },
      },
    }),
    readStoreSettings(),
  ]);
  if (!order) notFound();
  // A bill exists only for ACTIVE orders (Processing / Shipped / Out-for-delivery
  // / Delivered). Pending / Cancelled / Returned orders have no bill — block the
  // invoice so one can't be generated. (POS orders are born DELIVERED, so their
  // invoices are unaffected.)
  if (!hasBill(order.status)) notFound();

  const storeName = settings.storeName || "Farmyzest";
  // Items without their own tax slab fall back to the store default (5% if the
  // shop hasn't set one) so the GST breakup is never blank.
  const defaultGstRate = settings.defaultGstRate ?? 5;
  // POS bills show the discount actually rung; online orders show each line's
  // CURRENT auto-tier % (so the whole history reflects the latest offers with a
  // clean per-line %, not a blended average). See src/lib/order-invoice.ts.
  const inv = await buildOrderInvoice(order, defaultGstRate);
  const hasSpecialPriceLine = inv.lines.some((l) => l.isSpecialPrice);
  // The bill-level discount lumps together loyalty-points redemption and any
  // other cart-level discount — split the points out so the customer sees it as
  // its own line rather than a mysterious "bill discount".
  const loyaltyRedeemed = Math.min(order.loyaltyDiscount ?? 0, inv.totals.billDiscount);
  const otherBillDiscount = Math.round((inv.totals.billDiscount - loyaltyRedeemed) * 100) / 100;

  const invoiceNo = order.posOrderNum ?? order.id.slice(-8).toUpperCase();
  const date = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const customer = order.billingName || order.shippingName || "Walk-in customer";
  const phone = order.billingPhone || order.shippingPhone || "";
  const paid = Math.max(0, order.total - (order.walletApplied ?? 0));

  // GSTIN: prefer the saved store setting, fall back to the company constant.
  const gstin = settings.gstNumber || COMPANY_GSTIN;
  // Store contact block: prefer the saved settings, fall back to the durable
  // company.ts constants so the header is never blank (e.g. right after a deploy
  // and before settings are re-saved).
  const storeAddress = settings.storeAddress || STORE_ADDRESS;
  const storePhone = settings.storePhone || STORE_PHONE;
  const storeEmail = settings.storeEmail || STORE_EMAIL;
  // QR to the website (data-URI so the printed/PDF bill is self-contained).
  const qrDataUrl = await QRCode.toDataURL(SITE_URL, {
    margin: 1,
    width: 140,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="invoice-screen min-h-screen bg-nate-grey-100 py-6 px-4 print:bg-white print:p-0">
      <style>{`
        @page { size: A5 portrait; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .invoice-screen { padding: 0 !important; background: #fff !important; }
          .invoice-sheet { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
        }
        /* #9 — make MRP / Discount / Net Rate stand out on the bill. */
        .bill-hl { background: #fff7ed; }
        .bill-hl-strong { background: #ffedd5; font-weight: 600; }
        @media print {
          .bill-hl, .bill-hl-strong {
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>

      <div
        className="invoice-sheet mx-auto bg-white text-nate-grey-900 shadow-sm"
        style={{ width: "148mm", padding: "8mm", fontSize: "10px", lineHeight: 1.45 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-nate-grey-900 pb-2">
          <div>
            <h1 className="font-serif" style={{ fontSize: "20px", lineHeight: 1.1 }}>{storeName}</h1>
            <p className="text-nate-grey-800 font-medium">{COMPANY_NAME}</p>
            {storeAddress && (
              <p className="text-nate-grey-600" style={{ maxWidth: "70mm" }}>{storeAddress}</p>
            )}
            <p className="text-nate-grey-600">
              {storePhone ? `Ph: ${storePhone}` : ""}
              {storePhone && storeEmail ? "  ·  " : ""}
              {storeEmail ?? ""}
            </p>
            {gstin && (
              <p className="text-nate-grey-700 font-medium">GSTIN: {gstin}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-semibold uppercase tracking-wide text-nate-grey-500" style={{ fontSize: "11px" }}>
              Tax Invoice
            </p>
            <p className="font-mono font-semibold" style={{ fontSize: "12px" }}>{invoiceNo}</p>
            <p className="text-nate-grey-600">{date}</p>
            <p className="text-nate-grey-600">
              {order.source === "POS" ? "In-store (POS)" : "Online"}
            </p>
            {order.salesman?.name && (
              <p className="text-nate-grey-600">Billed by: {order.salesman.name}</p>
            )}
            {/* Attended by falls back to the biller for older bills where no
                separate attender was recorded at the counter — so every bill
                with a salesman shows an attended-by line. */}
            {(order.attendedBy?.name || order.salesman?.name) && (
              <p className="text-nate-grey-600">
                Attended by: {order.attendedBy?.name ?? order.salesman?.name}
              </p>
            )}
          </div>
        </div>

        {/* Bill to */}
        <div className="flex justify-between py-2 border-b border-nate-grey-200">
          <div>
            <p className="text-nate-grey-400 uppercase tracking-wide" style={{ fontSize: "8px" }}>Bill To</p>
            <p className="font-medium">{customer}</p>
            {phone && <p className="text-nate-grey-600">{phone}</p>}
            {order.billingAddress && <p className="text-nate-grey-600">{order.billingAddress}</p>}
          </div>
          <div className="text-right">
            <p className="text-nate-grey-400 uppercase tracking-wide" style={{ fontSize: "8px" }}>Payment</p>
            <p className="font-medium">{order.paymentMethod} · {order.paymentStatus}</p>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full" style={{ borderCollapse: "collapse", marginTop: "6px" }}>
          <thead>
            <tr className="text-nate-grey-500 uppercase" style={{ fontSize: "8px", letterSpacing: "0.04em" }}>
              <th className="text-left py-1" style={{ width: "6%" }}>#</th>
              <th className="text-left py-1">Item</th>
              <th className="text-center py-1">Qty</th>
              <th className="text-right py-1 bill-hl">MRP</th>
              <th className="text-right py-1 bill-hl">Disc</th>
              <th className="text-right py-1 bill-hl-strong">Net Rate</th>
              <th className="text-right py-1">Taxable</th>
              <th className="text-center py-1">GST%</th>
              <th className="text-right py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-t border-nate-grey-100 align-top">
                <td className="py-1 text-nate-grey-500">{i + 1}</td>
                <td className="py-1 pr-1">
                  <span className="text-nate-grey-900">{l.productName}</span>
                  {l.variantLabel && (
                    <span className="block text-nate-grey-400" style={{ fontSize: "8px" }}>{l.variantLabel}</span>
                  )}
                  {l.sku && (
                    <span className="block text-nate-grey-400 font-mono" style={{ fontSize: "8px" }}>{l.sku}</span>
                  )}
                </td>
                <td className="py-1 text-center">{l.quantity}</td>
                <td className="py-1 text-right bill-hl">{inr(l.listUnit)}</td>
                <td className="py-1 text-right bill-hl">
                  {l.discount > 0 ? (
                    l.discountType === "FIXED" ? (
                      // Entered as a rupee amount → show ₹ as the headline figure.
                      <>
                        <span className="block text-nate-grey-800 font-medium">
                          −{inr(l.discountValue ?? l.discount)}
                        </span>
                        <span className="block text-nate-grey-400" style={{ fontSize: "8px" }}>{pct(l.discountPct)}%</span>
                      </>
                    ) : (
                      // Entered as a percentage (or legacy) → show % as the headline.
                      <>
                        <span className="block text-nate-grey-800 font-medium">
                          {pct(l.discountType === "PERCENT" && l.discountValue != null ? l.discountValue : l.discountPct)}%
                        </span>
                        <span className="block text-nate-grey-400" style={{ fontSize: "8px" }}>−{inr(l.discount)}</span>
                      </>
                    )
                  ) : l.isSpecialPrice ? (
                    // Special Prices items are already marked down — no further
                    // discount stacks on top, so the bill says so explicitly.
                    <>
                      <span className="block text-nate-grey-500 font-medium">Special price</span>
                      <span className="block text-nate-grey-400" style={{ fontSize: "7px" }}>no extra discount</span>
                    </>
                  ) : (
                    <span className="text-nate-grey-400">—</span>
                  )}
                </td>
                {/* Net Rate = discounted price per unit (GST-inclusive, same scale as MRP). */}
                <td className="py-1 text-right bill-hl-strong">
                  {inr(l.listUnit - (l.quantity > 0 ? l.discount / l.quantity : 0))}
                </td>
                <td className="py-1 text-right">{inr(l.taxableValue)}</td>
                <td className="py-1 text-center text-nate-grey-500">{l.taxRate ? `${l.taxRate}%` : "—"}</td>
                <td className="py-1 text-right font-medium">{inr(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasSpecialPriceLine && (
          <p className="text-nate-grey-500 mt-1" style={{ fontSize: "8px" }}>
            * Items marked <span className="font-medium">Special price</span> are already discounted under
            our Special Prices offer — no further/bill discount applies to them.
          </p>
        )}

        {/* Lower block: tax summary (left) + totals (right) */}
        <div className="flex justify-between gap-4 mt-3">
          {/* Tax breakup by slab */}
          <div style={{ minWidth: "62mm" }}>
            <p className="text-nate-grey-400 uppercase tracking-wide mb-1" style={{ fontSize: "8px" }}>
              GST Breakup
            </p>
            <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "9px" }}>
              <thead>
                <tr className="text-nate-grey-500" style={{ fontSize: "8px" }}>
                  <th className="text-left py-0.5">Slab</th>
                  <th className="text-right py-0.5">Taxable</th>
                  <th className="text-right py-0.5">CGST</th>
                  <th className="text-right py-0.5">SGST</th>
                </tr>
              </thead>
              <tbody>
                {inv.taxSummary.map((t) => (
                  <tr key={t.rate} className="border-t border-nate-grey-100">
                    <td className="py-0.5">{t.rate ? `${t.rate}%` : "Exempt"}</td>
                    <td className="py-0.5 text-right">{inr(t.taxableValue)}</td>
                    <td className="py-0.5 text-right">{inr(t.cgst)}</td>
                    <td className="py-0.5 text-right">{inr(t.sgst)}</td>
                  </tr>
                ))}
                <tr className="border-t border-nate-grey-300 font-medium">
                  <td className="py-0.5">Total</td>
                  <td className="py-0.5 text-right">{inr(inv.totals.taxableValue)}</td>
                  <td className="py-0.5 text-right">{inr(inv.totals.cgst)}</td>
                  <td className="py-0.5 text-right">{inr(inv.totals.sgst)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals + discount breakup */}
          <div style={{ minWidth: "58mm" }} className="space-y-0.5">
            <Row label="Subtotal (incl. GST)" value={inr(inv.totals.grossSubtotal)} />
            {inv.totals.lineDiscount > 0 && (
              <Row label="Item discount" value={"− " + inr(inv.totals.lineDiscount)} muted />
            )}
            {loyaltyRedeemed > 0 && (
              <Row
                label={`Loyalty points redeemed${order.pointsRedeemed ? ` (${order.pointsRedeemed} pts)` : ""}`}
                value={"− " + inr(loyaltyRedeemed)}
                muted
              />
            )}
            {otherBillDiscount > 0 && (
              <Row label="Bill discount" value={"− " + inr(otherBillDiscount)} muted />
            )}
            <Row label="Taxable value" value={inr(inv.totals.taxableValue)} muted />
            <Row label="CGST" value={inr(inv.totals.cgst)} muted />
            <Row label="SGST" value={inr(inv.totals.sgst)} muted />
            <div className="flex justify-between border-t-2 border-nate-grey-900 pt-1 mt-1 font-semibold" style={{ fontSize: "12px" }}>
              <span>Grand Total</span>
              <span>{inr(inv.totals.grandTotal)}</span>
            </div>
            {order.walletApplied > 0 && (
              <Row label="Wallet credit" value={"− " + inr(order.walletApplied)} muted />
            )}
            {order.paidCredit > 0 ? (
              <>
                <Row label="Paid online (advance)" value={inr(Math.max(0, paid - order.paidCredit))} muted />
                <div className="flex justify-between font-semibold pt-0.5">
                  <span>Balance due on delivery</span>
                  <span>{inr(order.paidCredit)}</span>
                </div>
              </>
            ) : (
              order.walletApplied > 0 && (
                <div className="flex justify-between font-semibold pt-0.5">
                  <span>Amount Paid</span>
                  <span>{inr(paid)}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Amount in words */}
        <p className="mt-2 pt-2 border-t border-nate-grey-200 text-nate-grey-700">
          <span className="text-nate-grey-400">Amount in words: </span>
          <span className="font-medium">{rupeesInWords(paid)}</span>
        </p>

        {/* Footer: T&C (#11) · website QR (#12) · signatory */}
        <div className="flex justify-between items-end mt-4 gap-3">
          <div className="text-nate-grey-500" style={{ fontSize: "8px", maxWidth: "58mm" }}>
            <p className="font-semibold text-nate-grey-800" style={{ fontSize: "9px" }}>Terms &amp; Conditions</p>
            <p className="mt-0.5 text-nate-grey-700">{RETURN_POLICY_TEXT}</p>
            <p className="mt-1 text-nate-grey-400">Prices are inclusive of GST.</p>
            <p className="mt-1 text-nate-grey-400">Thank you for shopping with {storeName}.</p>
          </div>
          <div className="text-center text-nate-grey-500" style={{ fontSize: "7px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Scan to visit our website" style={{ width: "19mm", height: "19mm" }} />
            <p className="mt-0.5 leading-tight">Scan to visit<br />farmyzest.com</p>
          </div>
          <div className="text-center text-nate-grey-500" style={{ fontSize: "8px" }}>
            <div style={{ height: "10mm" }} />
            <p className="border-t border-nate-grey-300 pt-0.5">Authorised Signatory</p>
          </div>
        </div>
      </div>

      {/* Print control (screen only) */}
      <div className="no-print text-center mt-5">
        <PrintButton />
      </div>

      {autoprint === "1" && <AutoPrint />}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className={muted ? "text-nate-grey-500" : "text-nate-grey-600"}>{label}</span>
      <span className={`text-right ${muted ? "text-nate-grey-700" : "text-nate-grey-900"}`}>{value}</span>
    </div>
  );
}

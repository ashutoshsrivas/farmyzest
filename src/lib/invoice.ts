// Tax-invoice maths. Selling prices in this store are GST-INCLUSIVE, so the tax
// is *embedded* in every amount and must be backed out for the invoice:
//
//   taxable = inclusive / (1 + rate/100)
//   gst     = inclusive − taxable           (split 50/50 into CGST + SGST)
//
// A bill-level discount (one lump off the whole cart) is spread across the
// lines in proportion to each line's value, so the per-slab tax summary still
// adds up to what the customer actually paid.

export interface InvoiceLineInput {
  productName: string;
  variantLabel?: string | null;
  sku?: string | null;
  hsn?: string | null;
  quantity: number;
  /** Net per-unit price actually paid (GST-inclusive, after any line discount). */
  unitPrice: number;
  /** Pre-discount catalog unit price (GST-inclusive). */
  listPrice?: number | null;
  /** Net line total (GST-inclusive, after line discount, before bill discount). */
  totalPrice: number;
  /** Discount amount on this line (across the quantity). */
  discount?: number | null;
  /** How the line discount was entered at billing: "PERCENT" or "FIXED" (₹). */
  discountType?: string | null;
  /** The exact value entered — a % for PERCENT, or a ₹ amount for FIXED. */
  discountValue?: number | null;
  /** Embedded GST slab for this line, e.g. 5, 12, 18. */
  taxPercent?: number | null;
  /**
   * Most-restrictive max-discount cap (% of gross) for this line — the tighter of
   * the product's and its primary category's caps. null = uncapped. Mirrors the
   * cap POS enforced when the bill was rung, so a bill-level discount is spread
   * across lines the SAME way it was actually charged (a capped line — e.g. a
   * Special Prices item at 0% — absorbs none of it). Absent → treated as uncapped.
   */
  maxDiscountCapPct?: number | null;
  /** Line is a Special Prices item — drives the "no extra discount" bill note. */
  isSpecialPrice?: boolean;
}

export interface InvoiceLine {
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  hsn: string | null;
  quantity: number;
  listUnit: number; // gross per-unit MRP (GST-incl, pre-discount)
  grossLine: number; // listUnit × quantity — line value before any discount
  discount: number; // total discount on this line (line + allocated bill share)
  discountPct: number; // discount as a % of grossLine (0 when no discount)
  discountType: string | null; // "PERCENT" | "FIXED" — how it was entered (null = legacy)
  discountValue: number | null; // the exact value entered (% for PERCENT, ₹ for FIXED)
  taxableValue: number; // GST-exclusive amount after all discounts
  taxRate: number;
  cgst: number;
  sgst: number;
  lineTotal: number; // GST-inclusive amount paid for this line, post all discounts
  isSpecialPrice: boolean; // Special Prices item — shown as "no extra discount" on the bill
}

export interface TaxSummaryRow {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
}

export interface InvoiceTotals {
  grossSubtotal: number; // sum of list values, pre-discount (GST-incl)
  lineDiscount: number; // sum of per-line discounts
  billDiscount: number; // cart-level discount
  totalDiscount: number; // lineDiscount + billDiscount
  taxableValue: number; // GST-exclusive total after discounts
  cgst: number;
  sgst: number;
  totalTax: number;
  grandTotal: number; // GST-inclusive amount due (== order.total)
}

export interface InvoiceComputation {
  lines: InvoiceLine[];
  taxSummary: TaxSummaryRow[];
  totals: InvoiceTotals;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Allocate a bill-level discount across lines, each capped at its own `room`
 * (₹ headroom below its max-discount), proportional to net value — the same
 * water-filling POS uses when it rings the sale. Lines with 0 room (e.g. a
 * Special Prices item locked at 0% off) get nothing; the discount flows to the
 * lines that can take it. The returned shares always sum to `billDiscount`
 * (a final proportional top-up dumps any rounding/over-cap remainder so the
 * per-line breakup still reconciles to the order total even if a product's cap
 * changed after the sale).
 */
function allocateBillDiscount(
  billDiscount: number,
  lines: { net: number; room: number }[]
): number[] {
  const alloc = lines.map(() => 0);
  if (billDiscount <= 0 || lines.length === 0) return alloc;
  let remaining = billDiscount;
  // Water-fill: repeatedly hand the remaining discount to lines with spare room,
  // proportional to their net, until it's placed or no room is left.
  for (let iter = 0; iter < 12 && remaining > 0.005; iter++) {
    const open = lines
      .map((l, i) => ({ i, net: l.net }))
      .filter(({ i }) => lines[i].net > 0 && alloc[i] < lines[i].room - 1e-9);
    const openNet = open.reduce((s, o) => s + o.net, 0);
    if (openNet <= 0) break;
    let placed = 0;
    for (const o of open) {
      const give = Math.min(remaining * (o.net / openNet), lines[o.i].room - alloc[o.i]);
      alloc[o.i] += give;
      placed += give;
    }
    remaining -= placed;
  }
  // Any leftover (all rooms exhausted — only if caps tightened post-sale) is
  // spread proportionally so the shares still total the recorded bill discount.
  if (remaining > 0.005) {
    const totalNet = lines.reduce((s, l) => s + Math.max(0, l.net), 0);
    if (totalNet > 0) lines.forEach((l, i) => (alloc[i] += remaining * (Math.max(0, l.net) / totalNet)));
  }
  return alloc;
}

/**
 * Build the full GST + discount breakup for an order.
 *
 * @param items        order line items (GST-inclusive amounts)
 * @param orderSubtotal Order.subtotal — gross list value before any discount
 * @param orderDiscount Order.discount — TOTAL discount (line + bill)
 * @param orderTotal   Order.total — final GST-inclusive amount due
 * @param defaultRate  GST % to assume for lines with no tax slab on file, so
 *                     the breakup still shows (0 = treat them as exempt).
 */
export function computeInvoice(
  items: InvoiceLineInput[],
  orderSubtotal: number,
  orderDiscount: number,
  orderTotal: number,
  defaultRate = 0
): InvoiceComputation {
  const lineNet = items.map((i) => i.totalPrice);
  const sumLineNet = lineNet.reduce((s, n) => s + n, 0);
  const lineDiscountTotal = items.reduce((s, i) => s + (i.discount ?? 0), 0);
  // Whatever discount isn't attributable to a specific line is the cart-level
  // discount (clamped ≥ 0 to be defensive against rounding noise).
  const billDiscount = Math.max(0, orderDiscount - lineDiscountTotal);

  // Spread the bill-level discount across lines the SAME way POS charged it:
  // proportional to each line's net value but capped at each line's own
  // max-discount headroom. A line capped at 0% (e.g. a Special Prices item)
  // absorbs none, so it correctly shows 0% off while the rest carry the
  // discount — instead of a misleading flat % painted evenly on every line.
  const billAlloc = allocateBillDiscount(
    billDiscount,
    items.map((it, idx) => {
      const listUnit = it.listPrice ?? it.unitPrice;
      const gross = listUnit * it.quantity;
      const cap = it.maxDiscountCapPct;
      // Headroom in ₹ for the bill discount, after any per-line discount already
      // used. null cap = uncapped (Infinity); Special Prices (0%) → 0 room.
      const room = cap == null ? Infinity : Math.max(0, gross * (cap / 100) - (it.discount ?? 0));
      return { net: lineNet[idx], room };
    })
  );

  const lines: InvoiceLine[] = items.map((it, idx) => {
    const billShare = billAlloc[idx];
    const lineFinal = Math.max(0, lineNet[idx] - billShare); // GST-incl, all discounts off
    // Use the line's own slab if it has one, else fall back to the store default
    // so the GST breakup is never blank.
    const rate = it.taxPercent && it.taxPercent > 0 ? it.taxPercent : defaultRate;
    const taxable = rate > 0 ? lineFinal / (1 + rate / 100) : lineFinal;
    const gst = lineFinal - taxable;
    const listUnit = it.listPrice ?? it.unitPrice;
    const grossLine = listUnit * it.quantity;
    const discountAmt = (it.discount ?? 0) + billShare;
    const discountPct = grossLine > 0 ? (discountAmt / grossLine) * 100 : 0;
    return {
      productName: it.productName,
      variantLabel: it.variantLabel ?? null,
      sku: it.sku ?? null,
      hsn: it.hsn ?? null,
      quantity: it.quantity,
      listUnit: r2(listUnit),
      grossLine: r2(grossLine),
      discount: r2(discountAmt),
      discountPct: r2(discountPct),
      discountType: it.discountType ?? null,
      discountValue: it.discountValue != null ? r2(it.discountValue) : null,
      taxableValue: r2(taxable),
      taxRate: rate,
      cgst: r2(gst / 2),
      sgst: r2(gst / 2),
      lineTotal: r2(lineFinal),
      isSpecialPrice: it.isSpecialPrice ?? false,
    };
  });

  // Per-slab tax summary (the HSN/rate-wise block at the foot of a GST invoice).
  const byRate = new Map<number, TaxSummaryRow>();
  for (const l of lines) {
    const row = byRate.get(l.taxRate) ?? {
      rate: l.taxRate,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
    };
    row.taxableValue = r2(row.taxableValue + l.taxableValue);
    row.cgst = r2(row.cgst + l.cgst);
    row.sgst = r2(row.sgst + l.sgst);
    byRate.set(l.taxRate, row);
  }
  const taxSummary = [...byRate.values()].sort((a, b) => a.rate - b.rate);

  const taxableValue = r2(lines.reduce((s, l) => s + l.taxableValue, 0));
  const cgst = r2(lines.reduce((s, l) => s + l.cgst, 0));
  const sgst = r2(lines.reduce((s, l) => s + l.sgst, 0));

  return {
    lines,
    taxSummary,
    totals: {
      grossSubtotal: r2(orderSubtotal),
      lineDiscount: r2(lineDiscountTotal),
      billDiscount: r2(billDiscount),
      totalDiscount: r2(orderDiscount),
      taxableValue,
      cgst,
      sgst,
      totalTax: r2(cgst + sgst),
      grandTotal: r2(orderTotal),
    },
  };
}

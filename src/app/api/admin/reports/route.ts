import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────────────────────────────────────
// Generic report envelope. Every report — regardless of what it counts — returns
// the same shape, so the UI has ONE table renderer and ONE CSV serializer. To add
// a report you write a builder that returns a Report; view + download come free.
// ──────────────────────────────────────────────────────────────────────────────

type ColType = "text" | "number" | "money" | "percent" | "date" | "datetime";
type Cell = string | number | null;

interface Column {
  key: string;
  label: string;
  type?: ColType; // default "text"
}
interface Report {
  title: string;
  subtitle?: string;
  // Headline stat cards (pre-formatted strings).
  summary?: { label: string; value: string }[];
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>; // optional bottom "Total" row
}

// Report registry — keep keys in sync with the UI's REPORTS list.
type ReportType =
  | "sales-summary"
  | "pnl"
  | "payments"
  | "gst"
  | "category-sales"
  | "product-sales"
  | "brand-sales"
  | "salesman"
  | "customers"
  | "purchases"
  | "goods-returns"
  | "exchanges"
  | "coupons"
  | "wallet"
  | "credit"
  | "stock"
  | "low-stock"
  | "catalog";

// ── Helpers ────────────────────────────────────────────────────────────────────

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const round2 = (n: number) => Math.round(n * 100) / 100;

// Orders that count as real revenue: not cancelled / returned.
function validOrderWhere(from: Date, to: Date): Prisma.OrderWhereInput {
  return {
    status: { notIn: ["CANCELLED", "RETURNED"] },
    createdAt: { gte: from, lte: to },
  };
}

function dayKey(d: Date) {
  return d.toISOString().split("T")[0];
}

// Attribute an order's money across tender buckets. Handles split-tender (paid*
// fields) and single-method orders, plus store-credit (wallet).
function tender(o: {
  total: number;
  walletApplied: number;
  paymentMethod: string;
  paidCash: number;
  paidUpi: number;
  paidCard: number;
  paidCredit: number;
}) {
  const wallet = o.walletApplied || 0;
  const out = { cash: 0, upi: 0, card: 0, online: 0, credit: 0, wallet };
  if (o.paymentMethod === "SPLIT") {
    out.cash = o.paidCash;
    out.upi = o.paidUpi;
    out.card = o.paidCard;
    out.credit = o.paidCredit;
    return out;
  }
  const rest = Math.max(0, o.total - wallet);
  switch (o.paymentMethod) {
    case "CASH":
    case "COD":
      out.cash += rest;
      break;
    case "UPI":
      out.upi += rest;
      break;
    case "CARD":
      out.card += rest;
      break;
    case "CREDIT":
      out.credit += rest;
      break;
    default: // GATEWAY, ONLINE
      out.online += rest;
  }
  // Some older orders carry paidCredit without SPLIT — surface it.
  if (o.paidCredit && o.paymentMethod !== "CREDIT") out.credit += o.paidCredit;
  return out;
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") ?? "sales-summary") as ReportType;
  const format = sp.get("format") ?? "json";

  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(Date.now() - 30 * 86400_000);
  from.setHours(0, 0, 0, 0);
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  to.setHours(23, 59, 59, 999);

  try {
    const report = await build(type, from, to);
    if (format === "csv") {
      const csv = toCsv(report);
      const tag = `${type}-${dayKey(from)}_${dayKey(to)}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${tag}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(report);
  } catch (err) {
    console.error("[Reports]", type, err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

function build(type: ReportType, from: Date, to: Date): Promise<Report> {
  switch (type) {
    case "sales-summary": return salesSummary(from, to);
    case "pnl": return pnl(from, to);
    case "payments": return payments(from, to);
    case "gst": return gst(from, to);
    case "category-sales": return categorySales(from, to);
    case "product-sales": return productSales(from, to);
    case "brand-sales": return brandSales(from, to);
    case "salesman": return salesmanReport(from, to);
    case "customers": return customers(from, to);
    case "purchases": return purchases(from, to);
    case "goods-returns": return goodsReturns(from, to);
    case "exchanges": return exchanges(from, to);
    case "coupons": return coupons(from, to);
    case "wallet": return wallet();
    case "credit": return creditReport();
    case "stock": return stock();
    case "low-stock": return lowStock();
    case "catalog": return catalog();
    default: return Promise.reject(new Error("Unknown report type"));
  }
}

// ── CSV serializer (from the generic envelope) ──────────────────────────────────

function csvEsc(v: Cell): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvCell(v: Cell, type?: ColType): string {
  if (v == null) return "";
  if ((type === "money" || type === "number" || type === "percent") && typeof v === "number")
    return String(round2(v));
  return String(v);
}
function toCsv(r: Report): string {
  const lines: string[] = [];
  lines.push(r.columns.map((c) => csvEsc(c.label)).join(","));
  for (const row of r.rows)
    lines.push(r.columns.map((c) => csvEsc(csvCell(row[c.key] ?? null, c.type))).join(","));
  if (r.totals)
    lines.push(r.columns.map((c) => csvEsc(csvCell(r.totals![c.key] ?? null, c.type))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ════════════════════════════════════════════════════════════════════════════
// Report builders
// ════════════════════════════════════════════════════════════════════════════

// 1. Sales summary — per-day revenue, by channel.
async function salesSummary(from: Date, to: Date): Promise<Report> {
  const orders = await db.order.findMany({
    where: validOrderWhere(from, to),
    select: { createdAt: true, total: true, subtotal: true, taxAmount: true, discount: true, source: true },
  });
  const map = new Map<string, { orders: number; pos: number; online: number; gross: number; discount: number; tax: number; net: number }>();
  for (const o of orders) {
    const k = dayKey(o.createdAt);
    const g = map.get(k) ?? { orders: 0, pos: 0, online: 0, gross: 0, discount: 0, tax: 0, net: 0 };
    g.orders++;
    if (o.source === "POS") g.pos++; else g.online++;
    g.gross += o.total;
    g.discount += o.discount;
    g.tax += o.taxAmount;
    g.net += o.subtotal;
    map.set(k, g);
  }
  const rows = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, g]) => ({ date, orders: g.orders, pos: g.pos, online: g.online, gross: g.gross, discount: g.discount, tax: g.tax, net: g.net }));
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const grossTotal = sum("gross");
  const ordersTotal = sum("orders");
  return {
    title: "Sales Summary",
    subtitle: "Daily revenue across all channels (excludes cancelled / returned).",
    summary: [
      { label: "Total Sales", value: inr(grossTotal) },
      { label: "Orders", value: String(ordersTotal) },
      { label: "Avg Order Value", value: inr(ordersTotal ? grossTotal / ordersTotal : 0) },
      { label: "Tax Collected", value: inr(sum("tax")) },
    ],
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "orders", label: "Orders", type: "number" },
      { key: "pos", label: "POS", type: "number" },
      { key: "online", label: "Online", type: "number" },
      { key: "net", label: "Net (ex-GST)", type: "money" },
      { key: "discount", label: "Discount", type: "money" },
      { key: "tax", label: "GST", type: "money" },
      { key: "gross", label: "Gross", type: "money" },
    ],
    rows,
    totals: { date: "TOTAL", orders: ordersTotal, pos: sum("pos"), online: sum("online"), net: sum("net"), discount: sum("discount"), tax: sum("tax"), gross: grossTotal },
  };
}

// 2. Profit & Loss — uses the real cost snapshot taken at sale time.
async function pnl(from: Date, to: Date): Promise<Report> {
  const [orders, items] = await Promise.all([
    db.order.findMany({ where: validOrderWhere(from, to), select: { createdAt: true, subtotal: true, taxAmount: true } }),
    db.orderItem.findMany({
      where: { order: validOrderWhere(from, to) },
      select: { quantity: true, costPriceSnapshot: true, order: { select: { createdAt: true } } },
      take: 200_000,
    }),
  ]);
  const map = new Map<string, { revenue: number; tax: number; cogs: number }>();
  for (const o of orders) {
    const k = dayKey(o.createdAt);
    const g = map.get(k) ?? { revenue: 0, tax: 0, cogs: 0 };
    g.revenue += o.subtotal;
    g.tax += o.taxAmount;
    map.set(k, g);
  }
  let covered = 0, total = 0;
  for (const it of items) {
    total++;
    if (it.costPriceSnapshot == null) continue;
    covered++;
    const k = dayKey(it.order.createdAt);
    const g = map.get(k) ?? { revenue: 0, tax: 0, cogs: 0 };
    g.cogs += it.costPriceSnapshot * it.quantity;
    map.set(k, g);
  }
  const rows = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, g]) => {
    const gross = g.revenue - g.cogs;
    return { date, revenue: g.revenue, cogs: g.cogs, gross, margin: g.revenue ? round2((gross / g.revenue) * 100) : 0, tax: g.tax };
  });
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const cogs = rows.reduce((s, r) => s + r.cogs, 0);
  const grossProfit = revenue - cogs;
  const tax = rows.reduce((s, r) => s + r.tax, 0);
  const coverage = total ? Math.round((covered / total) * 100) : 0;
  return {
    title: "Profit & Loss",
    subtitle: `Cost from per-sale cost snapshots. Cost coverage: ${coverage}% of items sold.`,
    summary: [
      { label: "Revenue (ex-GST)", value: inr(revenue) },
      { label: "COGS", value: inr(cogs) },
      { label: "Gross Profit", value: inr(grossProfit) },
      { label: "Gross Margin", value: (revenue ? round2((grossProfit / revenue) * 100) : 0) + "%" },
    ],
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "revenue", label: "Revenue (ex-GST)", type: "money" },
      { key: "cogs", label: "COGS", type: "money" },
      { key: "gross", label: "Gross Profit", type: "money" },
      { key: "margin", label: "Margin", type: "percent" },
      { key: "tax", label: "GST Collected", type: "money" },
    ],
    rows,
    totals: { date: "TOTAL", revenue, cogs, gross: grossProfit, margin: revenue ? round2((grossProfit / revenue) * 100) : 0, tax },
  };
}

// 3. Payment methods — tender mix across all orders.
async function payments(from: Date, to: Date): Promise<Report> {
  const orders = await db.order.findMany({
    where: validOrderWhere(from, to),
    select: { total: true, walletApplied: true, paymentMethod: true, paidCash: true, paidUpi: true, paidCard: true, paidCredit: true },
  });
  const acc = { cash: 0, upi: 0, card: 0, online: 0, credit: 0, wallet: 0 };
  for (const o of orders) {
    const t = tender(o);
    acc.cash += t.cash; acc.upi += t.upi; acc.card += t.card; acc.online += t.online; acc.credit += t.credit; acc.wallet += t.wallet;
  }
  const labels: [keyof typeof acc, string][] = [
    ["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["online", "Online / Gateway"], ["wallet", "Store Credit (wallet)"], ["credit", "On Credit (unpaid)"],
  ];
  const grand = labels.reduce((s, [k]) => s + acc[k], 0);
  const rows = labels.map(([k, label]) => ({ method: label, amount: acc[k], share: grand ? round2((acc[k] / grand) * 100) : 0 }));
  return {
    title: "Payment Methods",
    subtitle: "How sales were tendered (split-tender aware).",
    summary: [
      { label: "Collected (cash+upi+card+online)", value: inr(acc.cash + acc.upi + acc.card + acc.online) },
      { label: "Store Credit Used", value: inr(acc.wallet) },
      { label: "Outstanding Credit", value: inr(acc.credit) },
      { label: "Orders", value: String(orders.length) },
    ],
    columns: [
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", type: "money" },
      { key: "share", label: "Share", type: "percent" },
    ],
    rows,
    totals: { method: "TOTAL", amount: grand, share: 100 },
  };
}

// 4. GST — taxable value & tax grouped by slab.
async function gst(from: Date, to: Date): Promise<Report> {
  const items = await db.orderItem.findMany({
    where: { order: validOrderWhere(from, to) },
    select: { totalPrice: true, taxPercent: true },
    take: 300_000,
  });
  const map = new Map<number, { taxable: number; tax: number }>();
  for (const it of items) {
    const p = it.taxPercent ?? 0;
    const g = map.get(p) ?? { taxable: 0, tax: 0 };
    g.taxable += it.totalPrice;
    g.tax += it.totalPrice * (p / 100);
    map.set(p, g);
  }
  const rows = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([p, g]) => ({ slab: p + "%", taxable: round2(g.taxable), tax: round2(g.tax) }));
  const taxable = rows.reduce((s, r) => s + r.taxable, 0);
  const tax = rows.reduce((s, r) => s + r.tax, 0);
  return {
    title: "GST Summary",
    subtitle: "Taxable value and GST grouped by tax slab (line-item level).",
    summary: [
      { label: "Taxable Value", value: inr(taxable) },
      { label: "GST", value: inr(tax) },
    ],
    columns: [
      { key: "slab", label: "GST Slab" },
      { key: "taxable", label: "Taxable Value", type: "money" },
      { key: "tax", label: "GST", type: "money" },
    ],
    rows,
    totals: { slab: "TOTAL", taxable, tax },
  };
}

// Shared: load sold line-items in range joined to their product (for category /
// product / brand reports). costPriceSnapshot is preferred; fall back to product.
async function soldLines(from: Date, to: Date) {
  const items = await db.orderItem.findMany({
    where: { order: validOrderWhere(from, to) },
    select: { productId: true, productName: true, quantity: true, totalPrice: true, costPriceSnapshot: true },
    take: 300_000,
  });
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, brand: true, costPrice: true, category: { select: { name: true } } },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  return items.map((i) => {
    const p = pmap.get(i.productId);
    const cost = (i.costPriceSnapshot ?? p?.costPrice ?? 0) * i.quantity;
    return {
      productId: i.productId,
      productName: p?.name ?? i.productName,
      brand: p?.brand ?? "—",
      category: p?.category?.name ?? "Uncategorized",
      units: i.quantity,
      revenue: i.totalPrice,
      cogs: cost,
    };
  });
}

// 5. Category sales.
async function categorySales(from: Date, to: Date): Promise<Report> {
  const lines = await soldLines(from, to);
  const map = new Map<string, { units: number; revenue: number; cogs: number }>();
  for (const l of lines) {
    const g = map.get(l.category) ?? { units: 0, revenue: 0, cogs: 0 };
    g.units += l.units; g.revenue += l.revenue; g.cogs += l.cogs;
    map.set(l.category, g);
  }
  const rows = [...map.entries()].map(([category, g]) => ({ category, units: g.units, revenue: round2(g.revenue), cogs: round2(g.cogs), profit: round2(g.revenue - g.cogs), margin: g.revenue ? round2(((g.revenue - g.cogs) / g.revenue) * 100) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const t = (k: "units" | "revenue" | "cogs" | "profit") => rows.reduce((s, r) => s + r[k], 0);
  return {
    title: "Sales by Category",
    columns: [
      { key: "category", label: "Category" },
      { key: "units", label: "Units", type: "number" },
      { key: "revenue", label: "Revenue", type: "money" },
      { key: "cogs", label: "COGS", type: "money" },
      { key: "profit", label: "Profit", type: "money" },
      { key: "margin", label: "Margin", type: "percent" },
    ],
    rows,
    totals: { category: "TOTAL", units: t("units"), revenue: round2(t("revenue")), cogs: round2(t("cogs")), profit: round2(t("profit")), margin: t("revenue") ? round2((t("profit") / t("revenue")) * 100) : 0 },
  };
}

// 6. Product sales (top performers).
async function productSales(from: Date, to: Date): Promise<Report> {
  const lines = await soldLines(from, to);
  const map = new Map<string, { name: string; brand: string; units: number; revenue: number; cogs: number }>();
  for (const l of lines) {
    const g = map.get(l.productId) ?? { name: l.productName, brand: l.brand, units: 0, revenue: 0, cogs: 0 };
    g.units += l.units; g.revenue += l.revenue; g.cogs += l.cogs;
    map.set(l.productId, g);
  }
  const all = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const rows = all.slice(0, 300).map((g) => ({ product: g.name, brand: g.brand, units: g.units, revenue: round2(g.revenue), profit: round2(g.revenue - g.cogs) }));
  return {
    title: "Sales by Product",
    subtitle: all.length > 300 ? `Top 300 of ${all.length} products by revenue.` : "Ranked by revenue.",
    columns: [
      { key: "product", label: "Product" },
      { key: "brand", label: "Brand" },
      { key: "units", label: "Units", type: "number" },
      { key: "revenue", label: "Revenue", type: "money" },
      { key: "profit", label: "Profit", type: "money" },
    ],
    rows,
    totals: { product: "TOTAL", brand: "", units: all.reduce((s, r) => s + r.units, 0), revenue: round2(all.reduce((s, r) => s + r.revenue, 0)), profit: round2(all.reduce((s, r) => s + (r.revenue - r.cogs), 0)) },
  };
}

// 7. Brand sales.
async function brandSales(from: Date, to: Date): Promise<Report> {
  const lines = await soldLines(from, to);
  const map = new Map<string, { units: number; revenue: number; cogs: number }>();
  for (const l of lines) {
    const g = map.get(l.brand) ?? { units: 0, revenue: 0, cogs: 0 };
    g.units += l.units; g.revenue += l.revenue; g.cogs += l.cogs;
    map.set(l.brand, g);
  }
  const rows = [...map.entries()].map(([brand, g]) => ({ brand, units: g.units, revenue: round2(g.revenue), profit: round2(g.revenue - g.cogs) })).sort((a, b) => b.revenue - a.revenue);
  return {
    title: "Sales by Brand",
    columns: [
      { key: "brand", label: "Brand" },
      { key: "units", label: "Units", type: "number" },
      { key: "revenue", label: "Revenue", type: "money" },
      { key: "profit", label: "Profit", type: "money" },
    ],
    rows,
    totals: { brand: "TOTAL", units: rows.reduce((s, r) => s + r.units, 0), revenue: round2(rows.reduce((s, r) => s + r.revenue, 0)), profit: round2(rows.reduce((s, r) => s + r.profit, 0)) },
  };
}

// 8. Salesman performance — sales, commission, incentive (POS).
async function salesmanReport(from: Date, to: Date): Promise<Report> {
  const orders = await db.order.findMany({
    where: { ...validOrderWhere(from, to), source: "POS" },
    select: {
      total: true, salesmanId: true, attendedById: true,
      salesman: { select: { name: true, commissionRate: true } },
      attendedBy: { select: { name: true, commissionRate: true } },
      items: { select: { totalPrice: true, salesmanId: true } },
    },
  });

  // Name + rate for any salesman referenced only on a LINE (article-wise) — they
  // may never have billed/attended an order in this window.
  const lineIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.salesmanId).filter(Boolean)))] as string[];
  const lineSm = lineIds.length
    ? await db.salesman.findMany({ where: { id: { in: lineIds } }, select: { id: true, name: true, commissionRate: true } })
    : [];
  const lineInfo = new Map(lineSm.map((s) => [s.id, { name: s.name, rate: s.commissionRate }]));

  interface Row { name: string; orders: number; sales: number; rate: number; commission: number; attended: number; }
  const map = new Map<string, Row>();
  const attendedCount = new Map<string, number>();
  const ensure = (id: string, name: string, rate: number): Row => {
    const r = map.get(id) ?? { name, orders: 0, sales: 0, rate, commission: 0, attended: 0 };
    map.set(id, r);
    return r;
  };

  for (const o of orders) {
    const billId = o.attendedById ?? o.salesmanId;
    if (!billId) continue;
    if (o.attendedById) attendedCount.set(o.attendedById, (attendedCount.get(o.attendedById) ?? 0) + 1);
    const billName = (o.attendedById ? o.attendedBy?.name : o.salesman?.name) ?? "—";
    const billRate = (o.attendedById ? o.attendedBy?.commissionRate : o.salesman?.commissionRate) ?? 0;

    // Article-wise lines → their own salesman; removed from the bill earner's base.
    let reassigned = 0;
    for (const it of o.items) {
      if (it.salesmanId && it.salesmanId !== billId) {
        const info = lineInfo.get(it.salesmanId);
        ensure(it.salesmanId, info?.name ?? "—", info?.rate ?? 0).sales += it.totalPrice;
        reassigned += it.totalPrice;
      }
    }
    const br = ensure(billId, billName, billRate);
    br.orders++;
    br.sales += o.total - reassigned;
  }
  for (const [id, r] of map) {
    r.commission = r.sales * (r.rate / 100);
    r.attended = attendedCount.get(id) ?? 0;
  }
  const rows = [...map.values()].sort((a, b) => b.sales - a.sales).map((r) => ({ name: r.name, orders: r.orders, sales: round2(r.sales), rate: r.rate, commission: round2(r.commission), attended: r.attended }));
  return {
    title: "Salesman Performance",
    subtitle: "Sales and commission (on bill value) credited to the attending salesman (POS orders).",
    columns: [
      { key: "name", label: "Salesman" },
      { key: "orders", label: "Orders", type: "number" },
      { key: "sales", label: "Sales", type: "money" },
      { key: "rate", label: "Comm. %", type: "percent" },
      { key: "commission", label: "Commission", type: "money" },
      { key: "attended", label: "Attended Orders", type: "number" },
    ],
    rows,
    totals: { name: "TOTAL", orders: rows.reduce((s, r) => s + r.orders, 0), sales: round2(rows.reduce((s, r) => s + r.sales, 0)), rate: null, commission: round2(rows.reduce((s, r) => s + r.commission, 0)), attended: rows.reduce((s, r) => s + r.attended, 0) },
  };
}

// 9. Customers — spend & repeat behaviour.
async function customers(from: Date, to: Date): Promise<Report> {
  const orders = await db.order.findMany({
    where: validOrderWhere(from, to),
    select: { total: true, createdAt: true, userId: true, billingName: true, billingPhone: true, shippingName: true, shippingPhone: true, user: { select: { name: true, email: true } } },
  });
  interface Row { name: string; phone: string; orders: number; spend: number; last: string; }
  const map = new Map<string, Row>();
  for (const o of orders) {
    const phone = o.billingPhone || o.shippingPhone || "";
    const key = o.userId || phone || o.billingName || "guest-" + Math.random();
    const name = o.user?.name || o.billingName || o.shippingName || o.user?.email || "Guest";
    const r = map.get(key) ?? { name, phone, orders: 0, spend: 0, last: o.createdAt.toISOString() };
    r.orders++;
    r.spend += o.total;
    if (o.createdAt.toISOString() > r.last) r.last = o.createdAt.toISOString();
    map.set(key, r);
  }
  const all = [...map.values()].sort((a, b) => b.spend - a.spend);
  const repeat = all.filter((r) => r.orders > 1).length;
  const rows = all.slice(0, 500).map((r) => ({ name: r.name, phone: r.phone || "—", orders: r.orders, spend: round2(r.spend), last: dayKey(new Date(r.last)) }));
  return {
    title: "Customers",
    subtitle: all.length > 500 ? `Top 500 of ${all.length} customers by spend.` : "Ranked by spend.",
    summary: [
      { label: "Customers", value: String(all.length) },
      { label: "Repeat Customers", value: String(repeat) },
      { label: "Repeat Rate", value: (all.length ? Math.round((repeat / all.length) * 100) : 0) + "%" },
      { label: "Revenue", value: inr(all.reduce((s, r) => s + r.spend, 0)) },
    ],
    columns: [
      { key: "name", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "orders", label: "Orders", type: "number" },
      { key: "spend", label: "Total Spent", type: "money" },
      { key: "last", label: "Last Order", type: "date" },
    ],
    rows,
  };
}

// 10. Purchases — supplier bills in range.
async function purchases(from: Date, to: Date): Promise<Report> {
  const bills = await db.supplierBill.findMany({
    where: { date: { gte: from, lte: to } },
    select: { billNumber: true, date: true, subtotal: true, taxAmount: true, total: true, status: true, supplier: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  const rows = bills.map((b) => ({ bill: b.billNumber, date: dayKey(b.date), supplier: b.supplier?.name ?? "—", subtotal: round2(b.subtotal), tax: round2(b.taxAmount), total: round2(b.total), status: b.status }));
  const t = (k: "subtotal" | "tax" | "total") => round2(bills.reduce((s, b) => s + (b[k as keyof typeof b] as number), 0));
  return {
    title: "Purchases (Supplier Bills)",
    summary: [
      { label: "Bills", value: String(bills.length) },
      { label: "Total Purchased", value: inr(bills.reduce((s, b) => s + b.total, 0)) },
      { label: "Tax (input)", value: inr(bills.reduce((s, b) => s + b.taxAmount, 0)) },
    ],
    columns: [
      { key: "bill", label: "Bill #" },
      { key: "date", label: "Date", type: "date" },
      { key: "supplier", label: "Supplier" },
      { key: "subtotal", label: "Subtotal", type: "money" },
      { key: "tax", label: "Tax", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "status", label: "Status" },
    ],
    rows,
    totals: { bill: "TOTAL", date: "", supplier: "", subtotal: t("subtotal"), tax: t("tax"), total: t("total"), status: "" },
  };
}

// 11. Goods returns — customer & supplier, in range.
async function goodsReturns(from: Date, to: Date): Promise<Report> {
  const returns = await db.goodsReturn.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { items: true, supplier: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rows = returns.map((r) => ({
    date: dayKey(r.createdAt),
    kind: r.kind === "SUPPLIER" ? "To Supplier" : "By Customer",
    party: r.supplier?.name ?? r.note ?? "—",
    lines: r.items.length,
    units: r.items.reduce((s, i) => s + i.quantity, 0),
  }));
  const custUnits = rows.filter((r) => r.kind === "By Customer").reduce((s, r) => s + r.units, 0);
  const suppUnits = rows.filter((r) => r.kind === "To Supplier").reduce((s, r) => s + r.units, 0);
  return {
    title: "Goods Returns",
    subtitle: "Customer returns add stock; supplier returns remove it.",
    summary: [
      { label: "Returns", value: String(returns.length) },
      { label: "Units in (customer)", value: String(custUnits) },
      { label: "Units out (supplier)", value: String(suppUnits) },
    ],
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "kind", label: "Type" },
      { key: "party", label: "Supplier / Note" },
      { key: "lines", label: "Items", type: "number" },
      { key: "units", label: "Units", type: "number" },
    ],
    rows,
    totals: { date: "TOTAL", kind: "", party: "", lines: rows.reduce((s, r) => s + r.lines, 0), units: rows.reduce((s, r) => s + r.units, 0) },
  };
}

// 12. Exchanges.
async function exchanges(from: Date, to: Date): Promise<Report> {
  const list = await db.exchange.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { createdAt: true, orderId: true, reason: true, priceDifference: true, refundMethod: true, walletCreditAmount: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  const rows = list.map((e) => ({ date: dayKey(e.createdAt), order: e.orderId.slice(-8).toUpperCase(), reason: e.reason ?? "—", diff: round2(e.priceDifference), refund: e.refundMethod ?? "—", wallet: round2(e.walletCreditAmount), status: e.status }));
  return {
    title: "Exchanges",
    subtitle: "Price difference: positive = customer paid more; negative = refunded.",
    summary: [
      { label: "Exchanges", value: String(list.length) },
      { label: "Net Price Difference", value: inr(list.reduce((s, e) => s + e.priceDifference, 0)) },
      { label: "Wallet Credit Issued", value: inr(list.reduce((s, e) => s + e.walletCreditAmount, 0)) },
    ],
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "order", label: "Order" },
      { key: "reason", label: "Reason" },
      { key: "diff", label: "Price Diff", type: "money" },
      { key: "refund", label: "Refund Method" },
      { key: "wallet", label: "Wallet Credit", type: "money" },
      { key: "status", label: "Status" },
    ],
    rows,
  };
}

// 13. Coupons — usage & discount given in range.
async function coupons(from: Date, to: Date): Promise<Report> {
  const all = await db.coupon.findMany({ select: { id: true, code: true, type: true, value: true, timesUsed: true, isActive: true } });
  // Discount attributed to each coupon from orders in range.
  const grouped = await db.order.groupBy({
    by: ["couponId"],
    where: { ...validOrderWhere(from, to), couponId: { not: null } },
    _sum: { discount: true },
    _count: true,
  });
  const dmap = new Map(grouped.map((g) => [g.couponId, { discount: g._sum.discount ?? 0, count: g._count }]));
  const rows = all.map((c) => {
    const d = dmap.get(c.id);
    return { code: c.code, type: c.type, value: c.value, used: c.timesUsed, rangeOrders: d?.count ?? 0, discount: round2(d?.discount ?? 0), active: c.isActive ? "Yes" : "No" };
  }).sort((a, b) => b.discount - a.discount);
  return {
    title: "Coupons",
    subtitle: "Usage all-time; discount value within the selected range.",
    columns: [
      { key: "code", label: "Code" },
      { key: "type", label: "Type" },
      { key: "value", label: "Value", type: "number" },
      { key: "used", label: "Times Used", type: "number" },
      { key: "rangeOrders", label: "Orders (range)", type: "number" },
      { key: "discount", label: "Discount (range)", type: "money" },
      { key: "active", label: "Active" },
    ],
    rows,
    totals: { code: "TOTAL", type: "", value: null, used: rows.reduce((s, r) => s + r.used, 0), rangeOrders: rows.reduce((s, r) => s + r.rangeOrders, 0), discount: round2(rows.reduce((s, r) => s + r.discount, 0)), active: "" },
  };
}

// 14. Wallet / store credit outstanding (snapshot, not range).
async function wallet(): Promise<Report> {
  const wallets = await db.wallet.findMany({ where: { balance: { not: 0 } }, select: { phone: true, balance: true, user: { select: { name: true } } }, orderBy: { balance: "desc" } });
  const rows = wallets.map((w) => ({ phone: w.phone, name: w.user?.name ?? "—", balance: round2(w.balance) }));
  return {
    title: "Store Credit (Wallets)",
    subtitle: "Current outstanding store-credit balances.",
    summary: [
      { label: "Wallets with balance", value: String(wallets.length) },
      { label: "Total Outstanding", value: inr(wallets.reduce((s, w) => s + w.balance, 0)) },
    ],
    columns: [
      { key: "phone", label: "Phone" },
      { key: "name", label: "Customer" },
      { key: "balance", label: "Balance", type: "money" },
    ],
    rows,
    totals: { phone: "TOTAL", name: "", balance: round2(wallets.reduce((s, w) => s + w.balance, 0)) },
  };
}

// 15. Credit / receivables (all-time outstanding from credit sales).
async function creditReport(): Promise<Report> {
  const orders = await db.order.findMany({
    where: { paidCredit: { gt: 0 }, status: { notIn: ["CANCELLED", "RETURNED"] } },
    select: { paidCredit: true, createdAt: true, billingName: true, billingPhone: true, shippingName: true, shippingPhone: true, user: { select: { name: true } } },
  });
  interface Row { name: string; phone: string; outstanding: number; orders: number; last: string; }
  const map = new Map<string, Row>();
  for (const o of orders) {
    const phone = o.billingPhone || o.shippingPhone || "";
    const key = phone || o.billingName || "guest";
    const name = o.user?.name || o.billingName || o.shippingName || "Guest";
    const r = map.get(key) ?? { name, phone, outstanding: 0, orders: 0, last: o.createdAt.toISOString() };
    r.outstanding += o.paidCredit;
    r.orders++;
    if (o.createdAt.toISOString() > r.last) r.last = o.createdAt.toISOString();
    map.set(key, r);
  }
  const rows = [...map.values()].sort((a, b) => b.outstanding - a.outstanding).map((r) => ({ name: r.name, phone: r.phone || "—", outstanding: round2(r.outstanding), orders: r.orders, last: dayKey(new Date(r.last)) }));
  return {
    title: "Credit / Receivables",
    subtitle: "Outstanding amounts billed on credit (all-time). Settlement is tracked outside the app.",
    summary: [
      { label: "Customers owing", value: String(rows.length) },
      { label: "Total Outstanding", value: inr(rows.reduce((s, r) => s + r.outstanding, 0)) },
    ],
    columns: [
      { key: "name", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "outstanding", label: "Outstanding", type: "money" },
      { key: "orders", label: "Credit Orders", type: "number" },
      { key: "last", label: "Last Credit Sale", type: "date" },
    ],
    rows,
    totals: { name: "TOTAL", phone: "", outstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)), orders: rows.reduce((s, r) => s + r.orders, 0), last: "" },
  };
}

// 16. Stock valuation by category (snapshot).
async function stock(): Promise<Report> {
  const products = await db.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { mrp: true, costPrice: true, category: { select: { name: true } }, variants: { select: { stock: true, lowStockThreshold: true } } },
  });
  interface Row { category: string; variants: number; units: number; cost: number; retail: number; low: number; out: number; }
  const map = new Map<string, Row>();
  for (const p of products) {
    const cat = p.category?.name ?? "Uncategorized";
    const r = map.get(cat) ?? { category: cat, variants: 0, units: 0, cost: 0, retail: 0, low: 0, out: 0 };
    for (const v of p.variants) {
      r.variants++;
      r.units += v.stock;
      r.cost += (p.costPrice ?? 0) * v.stock;
      r.retail += p.mrp * v.stock;
      if (v.stock === 0) r.out++;
      else if (v.stock <= v.lowStockThreshold) r.low++;
    }
    map.set(cat, r);
  }
  const rows = [...map.values()].sort((a, b) => b.retail - a.retail).map((r) => ({ ...r, cost: round2(r.cost), retail: round2(r.retail) }));
  const t = (k: "variants" | "units" | "cost" | "retail" | "low" | "out") => rows.reduce((s, r) => s + (r[k] as number), 0);
  return {
    title: "Stock Valuation",
    subtitle: "Current inventory by category. Cost value uses product cost price.",
    summary: [
      { label: "Units in Stock", value: t("units").toLocaleString("en-IN") },
      { label: "Cost Value", value: inr(t("cost")) },
      { label: "Retail Value (MRP)", value: inr(t("retail")) },
      { label: "Out of Stock", value: String(t("out")) },
    ],
    columns: [
      { key: "category", label: "Category" },
      { key: "variants", label: "Variants", type: "number" },
      { key: "units", label: "Units", type: "number" },
      { key: "cost", label: "Cost Value", type: "money" },
      { key: "retail", label: "Retail (MRP)", type: "money" },
      { key: "low", label: "Low", type: "number" },
      { key: "out", label: "Out", type: "number" },
    ],
    rows,
    totals: { category: "TOTAL", variants: t("variants"), units: t("units"), cost: round2(t("cost")), retail: round2(t("retail")), low: t("low"), out: t("out") },
  };
}

// 17. Low / out-of-stock variants.
async function lowStock(): Promise<Report> {
  const variants = await db.productVariant.findMany({
    where: { product: { status: { not: "ARCHIVED" } } },
    select: { sku: true, size: true, color: true, stock: true, lowStockThreshold: true, product: { select: { name: true, category: { select: { name: true } } } } },
  });
  const rows = variants
    .filter((v) => v.stock <= v.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .map((v) => ({ product: v.product.name, category: v.product.category?.name ?? "—", sku: v.sku, variant: [v.color, v.size].filter(Boolean).join(" / ") || "—", stock: v.stock, threshold: v.lowStockThreshold, state: v.stock === 0 ? "OUT" : "LOW" }));
  return {
    title: "Low / Out of Stock",
    summary: [
      { label: "Need attention", value: String(rows.length) },
      { label: "Out of Stock", value: String(rows.filter((r) => r.state === "OUT").length) },
      { label: "Low Stock", value: String(rows.filter((r) => r.state === "LOW").length) },
    ],
    columns: [
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "sku", label: "SKU" },
      { key: "variant", label: "Variant" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "threshold", label: "Threshold", type: "number" },
      { key: "state", label: "State" },
    ],
    rows,
  };
}

// 18. Catalog — every product with variant count & stock.
async function catalog(): Promise<Report> {
  const products = await db.product.findMany({
    select: { name: true, brand: true, status: true, showOnWebsite: true, mrp: true, category: { select: { name: true } }, _count: { select: { variants: true } }, variants: { select: { stock: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const rows = products.map((p) => ({ product: p.name, brand: p.brand ?? "—", category: p.category?.name ?? "—", status: p.status, website: p.showOnWebsite ? "Yes" : "No", variants: p._count.variants, stock: p.variants.reduce((s, v) => s + v.stock, 0), mrp: round2(p.mrp) }));
  return {
    title: "Product Catalog",
    summary: [
      { label: "Products", value: String(products.length) },
      { label: "Variants", value: String(rows.reduce((s, r) => s + r.variants, 0)) },
      { label: "Units in Stock", value: rows.reduce((s, r) => s + r.stock, 0).toLocaleString("en-IN") },
    ],
    columns: [
      { key: "product", label: "Product" },
      { key: "brand", label: "Brand" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "website", label: "On Website" },
      { key: "variants", label: "Variants", type: "number" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "mrp", label: "MRP", type: "money" },
    ],
    rows,
  };
}

export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RegisterClient } from "./_components/RegisterClient";

// ── IST day handling ────────────────────────────────────────────────────────
// The server runs in UTC, but the shop's "day" is IST and must roll at 00:00
// IST (not 05:30 IST, which a naive UTC date would give). IST is a fixed +5:30
// with no DST, so we can shift by a constant.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY = 86400000;
const STRIP_DAYS = 30; // days shown in the timeline scrubber

/** yyyy-mm-dd for the IST calendar day containing instant `d`. */
function istYmd(d: Date): string {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
const istDayStart = (dateStr: string) => new Date(`${dateStr}T00:00:00.000+05:30`);
const istDayEnd = (dateStr: string) => new Date(`${dateStr}T23:59:59.999+05:30`);
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00.000+05:30`); // noon IST → safe from edges
  d.setUTCDate(d.getUTCDate() + n);
  return istYmd(d);
}

// Concise payment-method label from the split-tender breakdown.
function payLabel(o: { paidCash: number; paidUpi: number; paidCard: number; paidCredit: number; paymentMethod: string }) {
  const parts: string[] = [];
  if (o.paidCash > 0) parts.push("Cash");
  if (o.paidUpi > 0) parts.push("UPI");
  if (o.paidCard > 0) parts.push("Card");
  if (o.paidCredit > 0) parts.push("Credit");
  if (parts.length === 0) return o.paymentMethod === "CASH" ? "Cash" : o.paymentMethod === "UPI" ? "UPI" : o.paymentMethod === "GATEWAY" ? "Card" : "—";
  if (parts.length === 1) return parts[0];
  return "Split";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const sp = await searchParams;
  const todayStr = istYmd(new Date());
  let selStr = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayStr;
  if (selStr > todayStr) selStr = todayStr;

  const dayStart = istDayStart(selStr);
  const dayEnd = istDayEnd(selStr);

  // Timeline window: 30 IST days ending today, unless the selected day is older
  // — then end the strip on it so it's always visible.
  const recent = istDayStart(todayStr).getTime() - istDayStart(selStr).getTime() <= (STRIP_DAYS - 1) * DAY;
  const endStr = recent ? todayStr : selStr;
  const startStr = addDaysStr(endStr, -(STRIP_DAYS - 1));
  const windowStart = istDayStart(startStr);
  const windowEnd = istDayEnd(endStr);

  const [dayEntries, dayOrders, windowEntries, windowOrders, dayExchanges, windowExchanges] = await Promise.all([
    db.registerEntry.findMany({
      where: { entryDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    db.order.findMany({
      where: { source: "POS", status: { not: "CANCELLED" }, createdAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        posOrderNum: true,
        total: true,
        createdAt: true,
        paymentMethod: true,
        paidCash: true,
        paidUpi: true,
        paidCard: true,
        paidCredit: true,
        billingName: true,
        items: { select: { productName: true, quantity: true }, take: 12 },
      },
    }),
    db.registerEntry.findMany({
      where: { entryDate: { gte: windowStart, lte: windowEnd } },
      select: { kind: true, amount: true, entryDate: true },
    }),
    db.order.findMany({
      where: { source: "POS", status: { not: "CANCELLED" }, createdAt: { gte: windowStart, lte: windowEnd } },
      select: { total: true, createdAt: true },
    }),
    // Exchanges/refunds keyed by the day they were processed. A negative
    // priceDifference = money refunded to the customer (money OUT); a positive
    // one = extra collected on a pricier replacement (money IN).
    db.exchange.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        priceDifference: true,
        refundMethod: true,
        createdAt: true,
        order: { select: { posOrderNum: true, billingName: true, id: true } },
      },
    }),
    db.exchange.findMany({
      where: { createdAt: { gte: windowStart, lte: windowEnd } },
      select: { priceDifference: true, createdAt: true },
    }),
  ]);

  // --- Selected-day unified rows ---------------------------------------------
  const manualRows = dayEntries.map((e) => ({
    id: e.id,
    source: "MANUAL" as const,
    kind: e.kind as "CREDIT" | "DEBIT",
    amount: e.amount,
    note: e.note,
    category: e.category,
    paymentMethod: e.paymentMethod ?? null,
    at: e.entryDate.toISOString(),
  }));

  const posRows = dayOrders.map((o) => {
    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0);
    const first = o.items[0]?.productName ?? "POS sale";
    const summary = o.items.length > 1 ? `${first} +${o.items.length - 1} more` : first;
    return {
      id: o.id,
      source: "POS" as const,
      kind: "CREDIT" as const,
      amount: o.total,
      note: summary,
      category: null as string | null,
      paymentMethod: payLabel(o),
      at: o.createdAt.toISOString(),
      orderNumber: o.posOrderNum ?? o.id.slice(-8).toUpperCase(),
      customer: o.billingName ?? "Walk-in",
      itemCount,
    };
  });

  // Exchange/refund rows for the day. net = priceDifference (replacement −
  // returned): negative = refund OUT (DEBIT), positive = extra collected (CREDIT).
  const exchangeRows = dayExchanges.map((x) => {
    const net = x.priceDifference;
    const refund = net < 0;
    const method = (x.refundMethod ?? "").toUpperCase();
    const ref = x.order?.posOrderNum ?? x.order?.id?.slice(-8).toUpperCase() ?? "—";
    return {
      id: x.id,
      source: "EXCHANGE" as const,
      kind: refund ? ("DEBIT" as const) : ("CREDIT" as const),
      amount: Math.abs(net),
      note: refund ? `Refund on exchange · Bill #${ref}` : `Extra collected on exchange · Bill #${ref}`,
      category: "Exchange" as string | null,
      paymentMethod: method === "WALLET" ? "Wallet" : "Cash",
      at: x.createdAt.toISOString(),
      orderNumber: ref,
      customer: x.order?.billingName ?? "—",
    };
  });

  // Merge, newest first.
  const rows = [...manualRows, ...posRows, ...exchangeRows].sort((a, b) => (a.at < b.at ? 1 : -1));

  const posCredit = posRows.reduce((s, r) => s + r.amount, 0);
  const manualCredit = manualRows.filter((r) => r.kind === "CREDIT").reduce((s, r) => s + r.amount, 0);
  // Exchange money-in (upgrades) adds to credit; refunds add to debit — so the
  // day's Net reflects the full refund/exchange adjustment (all methods).
  const exchangeCredit = exchangeRows.filter((r) => r.kind === "CREDIT").reduce((s, r) => s + r.amount, 0);
  const exchangeDebit = exchangeRows.filter((r) => r.kind === "DEBIT").reduce((s, r) => s + r.amount, 0);
  const debit =
    manualRows.filter((r) => r.kind === "DEBIT").reduce((s, r) => s + r.amount, 0) + exchangeDebit;

  // Money in by tender method: POS split-tender + manual CREDIT entries tagged
  // with a method. "credit" = amount left on khata (owed), not received.
  const byMethod = { cash: 0, upi: 0, card: 0, credit: 0 };
  for (const o of dayOrders) {
    byMethod.cash += o.paidCash;
    byMethod.upi += o.paidUpi;
    byMethod.card += o.paidCard;
    byMethod.credit += o.paidCredit;
  }
  for (const e of dayEntries) {
    // Money-in ADDS to the tender; money-out (DEBIT) SUBTRACTS from the SAME
    // tender, so e.g. a ₹200 cash payout drops the cash total by 200 (not just
    // the net). sign flips on kind.
    const sign = e.kind === "DEBIT" ? -1 : 1;
    const m = (e.paymentMethod ?? "").toUpperCase();
    if (m === "CASH") byMethod.cash += sign * e.amount;
    else if (m === "UPI") byMethod.upi += sign * e.amount;
    else if (m === "CARD" || m === "GATEWAY") byMethod.card += sign * e.amount;
  }
  // Cash-settled exchanges move the drawer: a cash refund reduces cash, a cash
  // top-up adds to it. Wallet-settled refunds are store credit (no cash change).
  for (const r of exchangeRows) {
    if (r.paymentMethod !== "Cash") continue;
    byMethod.cash += (r.kind === "CREDIT" ? 1 : -1) * r.amount;
  }

  // --- Timeline buckets (keyed by IST day) -----------------------------------
  const buckets = new Map<string, { credit: number; debit: number; count: number }>();
  const ensure = (k: string) => {
    let b = buckets.get(k);
    if (!b) { b = { credit: 0, debit: 0, count: 0 }; buckets.set(k, b); }
    return b;
  };
  for (const e of windowEntries) {
    const b = ensure(istYmd(e.entryDate));
    if (e.kind === "CREDIT") b.credit += e.amount; else b.debit += e.amount;
    b.count += 1;
  }
  for (const o of windowOrders) {
    const b = ensure(istYmd(o.createdAt));
    b.credit += o.total;
    b.count += 1;
  }
  for (const x of windowExchanges) {
    const b = ensure(istYmd(x.createdAt));
    if (x.priceDifference < 0) b.debit += -x.priceDifference;
    else b.credit += x.priceDifference;
    b.count += 1;
  }

  const timeline: { date: string; credit: number; debit: number; net: number; count: number }[] = [];
  for (let i = 0; i < STRIP_DAYS; i++) {
    const key = addDaysStr(startStr, i);
    const b = buckets.get(key) ?? { credit: 0, debit: 0, count: 0 };
    timeline.push({ date: key, credit: b.credit, debit: b.debit, net: b.credit - b.debit, count: b.count });
  }

  return (
    <RegisterClient
      selectedDate={selStr}
      today={todayStr}
      timeline={timeline}
      rows={rows}
      totals={{ posCredit, manualCredit, debit, net: posCredit + manualCredit + exchangeCredit - debit, orderCount: posRows.length, byMethod }}
    />
  );
}

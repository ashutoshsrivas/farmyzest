"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search, Loader2, ArrowRight, Package, Wallet, Banknote, Check } from "lucide-react";
import toast from "react-hot-toast";

// Phone-first exchange flow, shared by the POS screen and the admin panel.
//
// Flow (matches the owner's spec):
//   1. Enter the customer's phone → look up everything they've bought,
//      grouped by bill (latest bill first).
//   2. Tick one OR MORE items to bring back (shows the price they PAID + a
//      per-item return quantity).
//   3. Optionally pick a replacement product/variant.
//   4. See the price difference (refund to give vs. extra to collect) and save.
//
// Saving reuses POST /api/admin/exchanges, which restores each returned item's
// stock, deducts the replacement's stock, and records the Exchange — all in one
// transaction. The single optional replacement is attached to the first
// returned line; the API sums the price difference across every line.

interface HistoryItem {
  orderItemId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number; // price actually paid
}
interface HistoryOrder {
  orderId: string;
  orderNumber: string;
  source: string;
  date: string;
  items: HistoryItem[];
}

interface SearchVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  priceOverride: number | null;
  stock: number;
  product: {
    name: string;
    mrp: number;
    onlinePrice: number | null;
    sellingPrice: number | null;
  };
  images?: { url: string; isPrimary: boolean }[];
}
interface SearchProduct {
  id: string;
  name: string;
  variants: SearchVariant[];
}

interface ExchangeFlowProps {
  onClose: () => void;
  onDone?: () => void;
  initialPhone?: string;
  /** Cosmetic only — POS uses a dark counter context, admin a light page. */
  mode?: "pos" | "admin";
}

// One returned line in the multi-select: the item, the order it came from, and
// how many of it the customer is bringing back.
interface ReturnLine {
  order: HistoryOrder;
  item: HistoryItem;
  qty: number;
}

function money(n: number) {
  return `₹${n.toFixed(2)}`;
}

function billDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function variantPrice(v: SearchVariant): number {
  return v.priceOverride ?? v.product.sellingPrice ?? v.product.onlinePrice ?? v.product.mrp ?? 0;
}

export function ExchangeFlow({ onClose, onDone, initialPhone }: ExchangeFlowProps) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [looking, setLooking] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);

  // Returned lines — multi-select, keyed by orderItemId.
  const [selected, setSelected] = useState<Record<string, ReturnLine>>({});
  // Secondary filter over the customer's purchase history — for customers with
  // a long list of past purchases, so the cashier can jump to the right item.
  const [itemFilter, setItemFilter] = useState("");

  // Replacement (optional).
  const [repSearch, setRepSearch] = useState("");
  const [repResults, setRepResults] = useState<SearchProduct[]>([]);
  const [repSearching, setRepSearching] = useState(false);
  const [replacement, setReplacement] = useState<SearchVariant | null>(null);
  const [repQty, setRepQty] = useState(1);

  const [submitting, setSubmitting] = useState(false);

  // How to settle money owed back to the customer (only relevant when the
  // return is worth more than the replacement). Default to store credit.
  const [refundMethod, setRefundMethod] = useState<"WALLET" | "CASH">("WALLET");

  const selectedLines = Object.values(selected);
  const hasSelection = selectedLines.length > 0;

  async function lookup() {
    const q = phone.trim();
    if (q.replace(/\D/g, "").length < 6) {
      toast.error("Enter at least 6 digits");
      return;
    }
    setLooking(true);
    setOrders(null);
    setSelected({});
    setReplacement(null);
    try {
      const res = await fetch(`/api/exchanges/history?phone=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Lookup failed");
        return;
      }
      setCustomerName(data.customerName ?? "");
      setOrders(data.orders ?? []);
      setItemFilter("");
      if ((data.orders ?? []).length === 0) toast("No purchases found for that number", { icon: "ℹ️" });
    } catch {
      toast.error("Network error during lookup");
    } finally {
      setLooking(false);
    }
  }

  function toggleItem(order: HistoryOrder, item: HistoryItem) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.orderItemId]) {
        delete next[item.orderItemId];
      } else {
        next[item.orderItemId] = { order, item, qty: 1 };
      }
      return next;
    });
  }

  function setLineQty(orderItemId: string, qty: number) {
    setSelected((prev) => {
      const line = prev[orderItemId];
      if (!line) return prev;
      const clamped = Math.max(1, Math.min(line.item.quantity, qty || 1));
      return { ...prev, [orderItemId]: { ...line, qty: clamped } };
    });
  }

  // Replacement product search (debounced), reusing the POS product endpoint.
  useEffect(() => {
    if (!hasSelection) return;
    if (!repSearch.trim()) {
      setRepResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setRepSearching(true);
      try {
        const res = await fetch(`/api/pos/products?search=${encodeURIComponent(repSearch)}&limit=30`);
        const data = await res.json();
        setRepResults(res.ok ? data.products ?? [] : []);
      } catch {
        setRepResults([]);
      } finally {
        setRepSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [repSearch, hasSelection]);

  const summary = useMemo(() => {
    if (selectedLines.length === 0) return null;
    const returnedTotal = selectedLines.reduce((sum, l) => sum + l.item.unitPrice * l.qty, 0);
    const replacementTotal = replacement ? variantPrice(replacement) * repQty : 0;
    const diff = replacementTotal - returnedTotal; // >0 collect, <0 refund
    return { returnedTotal, replacementTotal, diff };
  }, [selectedLines, replacement, repQty]);

  async function submit() {
    if (!hasSelection || !summary) return;
    for (const l of selectedLines) {
      if (l.qty < 1 || l.qty > l.item.quantity) {
        toast.error(`Return qty for ${l.item.productName} must be 1–${l.item.quantity}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      // The exchange record is keyed to ONE order (the order the first returned
      // line came from). Stock + wallet movements operate per-variant/amount, so
      // they stay correct even when lines span multiple bills.
      const orderId = selectedLines[0].order.orderId;
      // Attach the single optional replacement to the first returned line; all
      // other lines are pure returns. The API sums the diff across lines.
      const items = selectedLines.map((l, idx) => ({
        returnedOrderItemId: l.item.orderItemId,
        returnedVariantId: l.item.variantId,
        returnedQuantity: l.qty,
        returnedUnitPrice: l.item.unitPrice,
        replacementVariantId: idx === 0 ? replacement?.id ?? null : null,
        replacementQuantity: idx === 0 && replacement ? repQty : 0,
        replacementUnitPrice: idx === 0 && replacement ? variantPrice(replacement) : null,
      }));
      const res = await fetch("/api/admin/exchanges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason: "POS exchange",
          // Only meaningful when the customer is owed money (diff < 0).
          refundMethod: summary.diff < 0 ? refundMethod : undefined,
          customerPhone: phone.trim() || undefined,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.insufficient) {
          toast.error(`Replacement out of stock (${data.insufficient[0]?.sku ?? ""})`);
        } else {
          toast.error(data.error ?? "Exchange failed");
        }
        return;
      }
      const diff = summary.diff;
      if (diff < 0 && refundMethod === "WALLET" && data.walletCreditAmount > 0) {
        toast.success(
          `Exchange done — ${money(data.walletCreditAmount)} added to wallet` +
            (typeof data.walletBalance === "number"
              ? ` (balance ${money(data.walletBalance)})`
              : "")
        );
      } else {
        toast.success(
          diff > 0
            ? `Exchange done — collect ${money(diff)}`
            : diff < 0
            ? `Exchange done — refund ${money(-diff)} cash`
            : "Exchange done — even swap"
        );
      }
      onDone?.();
      onClose();
    } catch {
      toast.error("Network error — please retry");
    } finally {
      setSubmitting(false);
    }
  }

  const itemQuery = itemFilter.trim().toLowerCase();
  const matchesFilter = (order: HistoryOrder, item: HistoryItem) =>
    !itemQuery ||
    item.productName.toLowerCase().includes(itemQuery) ||
    (item.sku ?? "").toLowerCase().includes(itemQuery) ||
    (item.variantLabel ?? "").toLowerCase().includes(itemQuery) ||
    order.orderNumber.toLowerCase().includes(itemQuery);

  // Total exchangeable items across all bills (for the header count).
  const totalItems = orders?.reduce((n, o) => n + o.items.length, 0) ?? 0;
  // Orders (already latest-first from the API) with their filter-matching items.
  const visibleGroups =
    orders?.map((o) => ({ order: o, items: o.items.filter((it) => matchesFilter(o, it)) }))
      .filter((g) => g.items.length > 0) ?? [];

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-nate-grey-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
          <div>
            <h2 className="text-lg font-medium">Exchange</h2>
            <p className="text-xs text-nate-grey-500 mt-0.5">
              Find the customer by phone, tick everything they’re returning, and (optionally) what they’re taking instead.
            </p>
          </div>
          <button onClick={onClose} className="text-nate-grey-400 hover:text-nate-grey-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step 1 — phone lookup */}
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="Customer phone number"
              inputMode="tel"
              className="flex-1 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
            />
            <button
              onClick={lookup}
              disabled={looking}
              className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
            >
              {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Find
            </button>
          </div>

          {/* Step 2 — purchase history, grouped by bill (latest first) */}
          {orders && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-nate-grey-500 mb-2">
                {customerName ? `${customerName} — ` : ""}purchases ({totalItems})
                {hasSelection && (
                  <span className="ml-2 text-nate-grey-700 normal-case tracking-normal">
                    · {selectedLines.length} selected
                  </span>
                )}
              </p>
              {totalItems === 0 ? (
                <p className="text-sm text-nate-grey-500">No exchangeable items for that number.</p>
              ) : (
                <>
                  {totalItems > 4 && (
                    <div className="relative mb-2">
                      <Search className="w-4 h-4 text-nate-grey-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={itemFilter}
                        onChange={(e) => setItemFilter(e.target.value)}
                        placeholder="Filter these items by name, SKU or bill…"
                        className="w-full border border-nate-grey-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                      />
                    </div>
                  )}
                  {visibleGroups.length === 0 ? (
                    <p className="text-sm text-nate-grey-500 py-2">
                      No items match “{itemFilter.trim()}”.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {visibleGroups.map(({ order, items }) => (
                        <div key={order.orderId}>
                          {/* Bill header */}
                          <div className="flex items-center justify-between px-1 mb-1">
                            <span className="text-xs font-semibold text-nate-grey-700">
                              {order.orderNumber}
                              <span className="ml-2 font-normal text-nate-grey-400">
                                {billDate(order.date)}
                                {order.source === "POS" ? " · POS" : " · Online"}
                              </span>
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map((item) => {
                              const line = selected[item.orderItemId];
                              const active = !!line;
                              return (
                                <div
                                  key={item.orderItemId}
                                  className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                                    active ? "border-nate-grey-900 bg-nate-grey-50" : "border-nate-grey-200"
                                  }`}
                                >
                                  <button
                                    onClick={() => toggleItem(order, item)}
                                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                  >
                                    {/* Checkbox */}
                                    <span
                                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                        active ? "bg-nate-grey-900 border-nate-grey-900 text-white" : "border-nate-grey-300"
                                      }`}
                                    >
                                      {active && <Check className="w-3.5 h-3.5" />}
                                    </span>
                                    <div className="w-9 h-9 rounded bg-nate-grey-100 flex items-center justify-center overflow-hidden shrink-0">
                                      {item.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <Package className="w-4 h-4 text-nate-grey-300" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{item.productName}</div>
                                      <div className="text-xs text-nate-grey-500">
                                        {[item.variantLabel, item.sku].filter(Boolean).join(" · ")} · qty {item.quantity}
                                      </div>
                                    </div>
                                    <div className="text-sm font-semibold shrink-0">{money(item.unitPrice)}</div>
                                  </button>
                                  {/* Per-line return qty (only when selected and >1 bought) */}
                                  {active && item.quantity > 1 && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[11px] text-nate-grey-400">×</span>
                                      <input
                                        type="text" inputMode="decimal"
                                        min={1}
                                        max={item.quantity}
                                        value={line.qty}
                                        onChange={(e) => setLineQty(item.orderItemId, parseInt(e.target.value) || 1)}
                                        className="w-14 border border-nate-grey-200 rounded px-1.5 py-1 text-sm text-center outline-none focus:ring-1 focus:ring-accent"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3 — replacement */}
          {hasSelection && (
            <div className="space-y-4 border-t border-nate-grey-100 pt-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-nate-grey-500 mb-2">
                  Replacement (optional)
                </p>
                {replacement ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg border border-nate-grey-900 bg-nate-grey-50">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{replacement.product.name}</div>
                      <div className="text-xs text-nate-grey-500">
                        {[replacement.color, replacement.size].filter(Boolean).join(" / ")} · {replacement.sku} · stock {replacement.stock}
                      </div>
                    </div>
                    <input
                      type="text" inputMode="decimal"
                      min={1}
                      value={repQty}
                      onChange={(e) => setRepQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 border border-nate-grey-200 rounded px-2 py-1 text-sm outline-none"
                    />
                    <div className="text-sm font-semibold">{money(variantPrice(replacement))}</div>
                    <button onClick={() => setReplacement(null)} className="text-nate-grey-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
                      <input
                        value={repSearch}
                        onChange={(e) => setRepSearch(e.target.value)}
                        placeholder="Search product / SKU to swap for…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-nate-grey-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    {repSearching && <p className="text-xs text-nate-grey-400 mt-1">Searching…</p>}
                    {repResults.length > 0 && (
                      <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                        {repResults.flatMap((p) =>
                          p.variants.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => {
                                setReplacement(v);
                                setRepQty(1);
                                setRepResults([]);
                                setRepSearch("");
                              }}
                              className="w-full flex items-center gap-3 p-2 rounded-lg border border-nate-grey-200 hover:bg-nate-grey-50 text-left"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{v.product.name}</div>
                                <div className="text-xs text-nate-grey-500">
                                  {[v.color, v.size].filter(Boolean).join(" / ")} · {v.sku} · stock {v.stock}
                                </div>
                              </div>
                              <div className="text-sm font-semibold">{money(variantPrice(v))}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — summary + submit */}
        {hasSelection && summary && (
          <div className="border-t border-nate-grey-100 px-6 py-4 bg-nate-grey-50 rounded-b-2xl">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex items-center gap-2 text-nate-grey-600">
                <span>
                  {money(summary.returnedTotal)} returned
                  <span className="text-nate-grey-400"> ({selectedLines.length})</span>
                </span>
                <ArrowRight className="w-4 h-4 text-nate-grey-400" />
                <span>{money(summary.replacementTotal)} replacement</span>
              </div>
              <div
                className={`text-base font-semibold ${
                  summary.diff > 0 ? "text-red-600" : summary.diff < 0 ? "text-green-700" : "text-nate-grey-700"
                }`}
              >
                {summary.diff > 0
                  ? `Collect ${money(summary.diff)}`
                  : summary.diff < 0
                  ? `Refund ${money(-summary.diff)}`
                  : "Even swap"}
              </div>
            </div>

            {/* Settlement choice — only when the customer is owed money. */}
            {summary.diff < 0 && (
              <div className="mb-3">
                <p className="text-xs text-nate-grey-500 mb-1.5">
                  How should {money(-summary.diff)} be refunded?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod("WALLET")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      refundMethod === "WALLET"
                        ? "border-nate-grey-900 bg-nate-grey-900 text-white"
                        : "border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-100"
                    }`}
                  >
                    <Wallet className="w-4 h-4" /> Add to wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod("CASH")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      refundMethod === "CASH"
                        ? "border-nate-grey-900 bg-nate-grey-900 text-white"
                        : "border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-100"
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> Cash refund
                  </button>
                </div>
                {refundMethod === "WALLET" && phone.replace(/\D/g, "").length < 10 && (
                  <p className="text-[11px] text-red-600 mt-1.5">
                    Store credit needs the customer&apos;s 10-digit phone (entered above).
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-nate-grey-700 hover:text-black disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {replacement ? "Complete exchange" : "Complete return"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

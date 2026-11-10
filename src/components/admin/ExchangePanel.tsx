"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Search,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Admin-side exchange panel for /admin/orders/[id].
//
// Flow:
//   1. Click "Exchange / return" → modal opens with the order's items.
//   2. For each item the admin wants to act on, set returnedQty, then
//      either (a) leave replacement blank for a straight return, or
//      (b) search for a replacement variant by name/SKU/barcode and set qty.
//   3. The modal computes price difference live.
//   4. Confirm → POST to /api/admin/exchanges. Stock movements run inside a
//      single transaction server-side.
//
// Lookups for replacements hit /api/pos/products which already returns the
// enriched shape we need (variants carry their parent product info).

interface OrderItemLite {
  id: string;
  productName: string;
  variantLabel: string | null;
  variantId: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
}

interface ProductLite {
  id: string;
  name: string;
  variants: {
    id: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    stock: number;
    priceOverride: number | null;
    product: {
      mrp: number;
      onlinePrice: number | null;
      sellingPrice: number | null;
    };
  }[];
  images: { url: string; isPrimary: boolean }[];
}

interface ExchangeLine {
  // The original order item being acted on.
  orderItemId: string;
  returnedVariantId: string;
  returnedQuantity: number;
  returnedUnitPrice: number;
  maxReturnable: number;

  // Optional replacement.
  replacement: null | {
    variantId: string;
    quantity: number;
    unitPrice: number;
    label: string;
    productName: string;
    inStock: number;
  };
}

interface ExchangePanelProps {
  orderId: string;
  orderItems: OrderItemLite[];
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function effectivePrice(v: ProductLite["variants"][number]): number {
  return (
    v.priceOverride ??
    v.product.sellingPrice ??
    v.product.onlinePrice ??
    v.product.mrp
  );
}

function variantLabel(v: ProductLite["variants"][number]): string {
  if (v.color && v.size) return `${v.color} / ${v.size}`;
  if (v.color) return v.color;
  if (v.size) return v.size;
  return "—";
}

export function ExchangePanel({ orderId, orderItems }: ExchangePanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ExchangeLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Settlement for money owed back to the customer (only when diff < 0).
  const [refundMethod, setRefundMethod] = useState<"WALLET" | "CASH">("WALLET");

  // Replacement picker state — local to whichever line the admin is editing.
  const [pickerLineIdx, setPickerLineIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [searching, setSearching] = useState(false);

  // Only items that came from inventory (have a variantId) are exchangeable.
  // POS cash-items can't go back to the shelf because there's no SKU.
  const eligibleOrderItems = useMemo(
    () => orderItems.filter((it) => !!it.variantId),
    [orderItems]
  );

  // Debounced search.
  useEffect(() => {
    if (pickerLineIdx == null) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pos/products?search=${encodeURIComponent(search)}&limit=20`
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults(data.products ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, pickerLineIdx]);

  // ── Line ops ────────────────────────────────────────────────────────────────
  function startLineForOrderItem(oi: OrderItemLite) {
    if (!oi.variantId) return;
    if (lines.some((l) => l.orderItemId === oi.id)) return; // already added
    setLines((prev) => [
      ...prev,
      {
        orderItemId: oi.id,
        returnedVariantId: oi.variantId!,
        returnedQuantity: 1,
        returnedUnitPrice: oi.unitPrice,
        maxReturnable: oi.quantity,
        replacement: null,
      },
    ]);
  }

  function updateLine(idx: number, patch: Partial<ExchangeLine>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function chooseReplacement(
    idx: number,
    v: ProductLite["variants"][number],
    product: ProductLite
  ) {
    updateLine(idx, {
      replacement: {
        variantId: v.id,
        quantity: 1,
        unitPrice: effectivePrice(v),
        label: variantLabel(v),
        productName: product.name,
        inStock: v.stock,
      },
    });
    setPickerLineIdx(null);
    setSearch("");
    setResults([]);
  }

  function clearReplacement(idx: number) {
    updateLine(idx, { replacement: null });
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let returnedTotal = 0;
    let replacementTotal = 0;
    for (const l of lines) {
      returnedTotal += l.returnedQuantity * l.returnedUnitPrice;
      if (l.replacement) {
        replacementTotal += l.replacement.quantity * l.replacement.unitPrice;
      }
    }
    return {
      returnedTotal,
      replacementTotal,
      diff: replacementTotal - returnedTotal,
    };
  }, [lines]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submit() {
    if (lines.length === 0) {
      setServerError("Add at least one line to exchange or return.");
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      const payload = {
        orderId,
        reason: reason || undefined,
        notes: notes || undefined,
        // Only meaningful when the customer is owed money. Wallet credit keys
        // off the order's saved billingPhone server-side.
        refundMethod: summary.diff < 0 ? refundMethod : undefined,
        items: lines.map((l) => ({
          returnedOrderItemId: l.orderItemId,
          returnedVariantId: l.returnedVariantId,
          returnedQuantity: l.returnedQuantity,
          returnedUnitPrice: l.returnedUnitPrice,
          replacementVariantId: l.replacement?.variantId ?? null,
          replacementQuantity: l.replacement?.quantity ?? 0,
          replacementUnitPrice: l.replacement?.unitPrice ?? null,
        })),
      };
      const res = await fetch("/api/admin/exchanges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.insufficient) {
          setServerError(
            `Replacement out of stock: ${data.insufficient
              .map((x: any) => `${x.sku} (${x.available} available, ${x.requested} requested)`)
              .join(", ")}`
          );
        } else {
          setServerError(data?.error ?? `Failed (${res.status})`);
        }
        return;
      }
      setSuccess(true);
      // Brief delay so the success state is visible, then reload page state.
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setLines([]);
        setReason("");
        setNotes("");
        router.refresh();
      }, 900);
    } catch {
      setServerError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors"
      >
        <ArrowLeftRight className="w-4 h-4" />
        Exchange / return
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) setOpen(false);
      }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-nate-grey-100 flex items-center justify-center text-nate-grey-700">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg text-nate-grey-900">
                Exchange / return
              </h2>
              <p className="text-xs text-nate-grey-500">
                Stock for returned items is restored. Replacement items are
                deducted in the same transaction.
              </p>
            </div>
          </div>
          <button
            onClick={() => !submitting && setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-nate-grey-100 text-nate-grey-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 1 — pick items from the order */}
          {lines.length === 0 && (
            <div className="p-6">
              <h3 className="text-sm font-medium text-nate-grey-800 mb-3">
                1. Pick an item to exchange or return
              </h3>
              {eligibleOrderItems.length === 0 ? (
                <p className="text-sm text-nate-grey-500">
                  This order has no inventory-tracked items.
                </p>
              ) : (
                <div className="space-y-2">
                  {eligibleOrderItems.map((oi) => (
                    <button
                      key={oi.id}
                      type="button"
                      onClick={() => startLineForOrderItem(oi)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-nate-grey-200 hover:border-nate-grey-400 hover:bg-nate-grey-50 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-lg bg-nate-grey-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {oi.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={oi.imageUrl}
                            alt={oi.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nate-grey-800 truncate">
                          {oi.productName}
                        </p>
                        <p className="text-xs text-nate-grey-500">
                          {oi.variantLabel ?? "—"} · {oi.sku ?? "no sku"} ·{" "}
                          {oi.quantity} × {inr(oi.unitPrice)}
                        </p>
                      </div>
                      <span className="text-xs text-accent font-medium">
                        Select →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — line editor */}
          {lines.length > 0 && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-nate-grey-800">
                  Exchange lines
                </h3>
                {eligibleOrderItems.length > lines.length && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = eligibleOrderItems.find(
                        (oi) => !lines.some((l) => l.orderItemId === oi.id)
                      );
                      if (next) startLineForOrderItem(next);
                    }}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    + Add another item from this order
                  </button>
                )}
              </div>

              {lines.map((line, idx) => {
                const oi = orderItems.find((o) => o.id === line.orderItemId)!;
                return (
                  <div
                    key={line.orderItemId}
                    className="border border-nate-grey-200 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-nate-grey-100 overflow-hidden shrink-0">
                          {oi.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={oi.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-nate-grey-800 truncate">
                            {oi.productName}
                          </p>
                          <p className="text-xs text-nate-grey-500">
                            {oi.variantLabel ?? "—"} · {oi.sku ?? "no sku"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-nate-grey-400 hover:text-red-600 p-1"
                        title="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Returned side */}
                      <div className="bg-nate-grey-50 rounded-lg p-3">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500 mb-2">
                          Returning
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-nate-grey-600">
                            Qty
                          </label>
                          <input
                            type="text" inputMode="decimal"
                            min={1}
                            max={line.maxReturnable}
                            value={line.returnedQuantity}
                            onChange={(e) =>
                              updateLine(idx, {
                                returnedQuantity: Math.max(
                                  1,
                                  Math.min(
                                    line.maxReturnable,
                                    parseInt(e.target.value) || 1
                                  )
                                ),
                              })
                            }
                            className="w-16 border border-nate-grey-200 rounded px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-nate-grey-500">
                            of {line.maxReturnable}
                          </span>
                          <span className="ml-auto text-sm font-medium text-nate-grey-800">
                            {inr(line.returnedQuantity * line.returnedUnitPrice)}
                          </span>
                        </div>
                        <p className="text-xs text-nate-grey-500 mt-2">
                          Stock will be restored: <strong>+{line.returnedQuantity}</strong>
                        </p>
                      </div>

                      {/* Replacement side */}
                      <div className="bg-nate-grey-50 rounded-lg p-3">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500 mb-2">
                          Replacing with
                        </p>
                        {line.replacement ? (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-nate-grey-800 truncate">
                                  {line.replacement.productName}
                                </p>
                                <p className="text-xs text-nate-grey-500">
                                  {line.replacement.label} ·{" "}
                                  {inr(line.replacement.unitPrice)} ea
                                </p>
                                <p className="text-[10px] text-nate-grey-400">
                                  Stock available: {line.replacement.inStock}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => clearReplacement(idx)}
                                className="text-nate-grey-400 hover:text-red-600 p-0.5"
                                title="Remove replacement"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-nate-grey-600">
                                Qty
                              </label>
                              <input
                                type="text" inputMode="decimal"
                                min={1}
                                max={line.replacement.inStock}
                                value={line.replacement.quantity}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    replacement: {
                                      ...line.replacement!,
                                      quantity: Math.max(
                                        1,
                                        Math.min(
                                          line.replacement!.inStock,
                                          parseInt(e.target.value) || 1
                                        )
                                      ),
                                    },
                                  })
                                }
                                className="w-16 border border-nate-grey-200 rounded px-2 py-1 text-sm"
                              />
                              <span className="ml-auto text-sm font-medium text-nate-grey-800">
                                {inr(
                                  line.replacement.quantity *
                                    line.replacement.unitPrice
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPickerLineIdx(idx);
                              setSearch("");
                              setResults([]);
                            }}
                            className="w-full text-sm text-nate-grey-600 hover:text-nate-grey-800 border border-dashed border-nate-grey-300 rounded-lg py-3 hover:bg-white transition-colors"
                          >
                            + Pick replacement item
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Reason / notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-nate-grey-700 mb-1">
                    Reason (shown in reports)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Size doesn't fit"
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nate-grey-700 mb-1">
                    Notes (internal)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything to remember…"
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-nate-grey-900 text-white rounded-lg p-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-nate-grey-300">Returned value</span>
                  <span>{inr(summary.returnedTotal)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-nate-grey-300">Replacement value</span>
                  <span>{inr(summary.replacementTotal)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/15 text-base font-medium">
                  <span>
                    {summary.diff > 0
                      ? "Customer pays extra"
                      : summary.diff < 0
                      ? "Refund to customer"
                      : "Even exchange"}
                  </span>
                  <span
                    className={
                      summary.diff > 0
                        ? "text-amber-300"
                        : summary.diff < 0
                        ? "text-green-300"
                        : "text-white"
                    }
                  >
                    {summary.diff === 0
                      ? "₹0"
                      : inr(Math.abs(summary.diff))}
                  </span>
                </div>

                {/* Settlement choice when the customer is owed money */}
                {summary.diff < 0 && (
                  <div className="mt-3 pt-3 border-t border-white/15">
                    <p className="text-xs text-nate-grey-300 mb-2">
                      Refund {inr(Math.abs(summary.diff))} as:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRefundMethod("WALLET")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          refundMethod === "WALLET"
                            ? "bg-white text-nate-grey-900"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        Store credit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefundMethod("CASH")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          refundMethod === "CASH"
                            ? "bg-white text-nate-grey-900"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        Cash / refund
                      </button>
                    </div>
                    {refundMethod === "WALLET" && (
                      <p className="text-[11px] text-nate-grey-400 mt-1.5">
                        Credited to the wallet for the phone on this order.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {serverError}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Exchange recorded — refreshing order…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && (
          <div className="border-t border-nate-grey-100 px-6 py-4 flex items-center justify-between bg-nate-grey-50">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="text-sm text-nate-grey-600 hover:text-nate-grey-800 px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || success}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving…" : "Confirm exchange"}
            </button>
          </div>
        )}

        {/* ── Replacement picker sub-modal ─────────────────────────────────── */}
        {pickerLineIdx != null && (
          <div
            className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPickerLineIdx(null);
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-nate-grey-100">
                <Search className="w-4 h-4 text-nate-grey-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by product name, SKU, or barcode…"
                  className="flex-1 outline-none text-sm placeholder-nate-grey-400"
                />
                <button
                  onClick={() => setPickerLineIdx(null)}
                  className="text-nate-grey-400 hover:text-nate-grey-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {searching && (
                  <p className="text-xs text-nate-grey-400 px-3 py-2">
                    Searching…
                  </p>
                )}
                {!searching && search.trim() && results.length === 0 && (
                  <p className="text-sm text-nate-grey-500 px-3 py-6 text-center">
                    No matches.
                  </p>
                )}
                {!search.trim() && (
                  <p className="text-xs text-nate-grey-400 px-3 py-2">
                    Type to search products. Replacement stock is checked at
                    submit time.
                  </p>
                )}
                {results.map((p) => (
                  <div key={p.id} className="mb-2">
                    <p className="text-xs font-medium text-nate-grey-700 px-2 py-1">
                      {p.name}
                    </p>
                    <div className="space-y-1">
                      {p.variants.map((v) => {
                        const outOfStock = v.stock <= 0;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={outOfStock}
                            onClick={() => chooseReplacement(pickerLineIdx, v, p)}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                              outOfStock
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-nate-grey-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-nate-grey-800">
                                {variantLabel(v)}
                              </p>
                              <p className="text-xs text-nate-grey-500">
                                SKU {v.sku} · BC {v.barcode}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-medium text-nate-grey-800">
                                {inr(effectivePrice(v))}
                              </p>
                              <p
                                className={`text-xs ${
                                  outOfStock
                                    ? "text-red-600"
                                    : v.stock <= 5
                                    ? "text-amber-600"
                                    : "text-nate-grey-500"
                                }`}
                              >
                                {outOfStock
                                  ? "Out of stock"
                                  : `${v.stock} in stock`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

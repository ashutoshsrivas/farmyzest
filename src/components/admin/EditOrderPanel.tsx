"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, X, Plus, Minus, Trash2, Search, Loader2, Banknote,
} from "lucide-react";

// Full bill editor for the admin order-detail page. Opens a modal where staff
// can change quantities / prices / discounts, add or remove items, set a
// bill-level discount and correct the customer, then PUTs the whole thing to
// /api/admin/orders/[id]. The server re-prices and reconciles stock.

type DiscountType = "PERCENT" | "FIXED";

export type EditLine = {
  key: string;
  variantId: string | null;
  productId: string;
  name: string;
  variantLabel: string | null;
  sku: string | null;
  unitPrice: number; // gross (pre-discount) unit price
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
};

type SearchVariant = {
  variantId: string;
  productId: string;
  name: string;
  variantLabel: string | null;
  sku: string;
  price: number;
  stock: number;
};

const inr = (n: number) => "₹" + n.toFixed(2);

function lineGross(l: EditLine) {
  return l.unitPrice * l.quantity;
}
function lineDiscount(l: EditLine) {
  const base = lineGross(l);
  if (!l.discountValue || l.discountValue <= 0) return 0;
  const raw = l.discountType === "FIXED" ? l.discountValue : (base * l.discountValue) / 100;
  return Math.min(base, Math.max(0, raw));
}

export function EditOrderPanel({
  orderId,
  initialItems,
  initialBillDiscount,
  initialCustomerName,
  initialCustomerPhone,
}: {
  orderId: string;
  initialItems: EditLine[];
  initialBillDiscount: { type: DiscountType; value: number };
  initialCustomerName: string;
  initialCustomerPhone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EditLine[]>(initialItems);
  const [billType, setBillType] = useState<DiscountType>(initialBillDiscount.type);
  const [billValue, setBillValue] = useState(
    initialBillDiscount.value ? String(initialBillDiscount.value) : ""
  );
  const [name, setName] = useState(initialCustomerName);
  const [phone, setPhone] = useState(initialCustomerPhone);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchVariant[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form to the order's current state each time the modal opens.
  function openModal() {
    setItems(initialItems);
    setBillType(initialBillDiscount.type);
    setBillValue(initialBillDiscount.value ? String(initialBillDiscount.value) : "");
    setName(initialCustomerName);
    setPhone(initialCustomerPhone);
    setSearch("");
    setResults([]);
    setError(null);
    setOpen(true);
  }

  // Product search → flat list of variants to add.
  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    const t = setTimeout(async () => {
      if (!q) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pos/products?search=${encodeURIComponent(q)}&limit=30`
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        const flat: SearchVariant[] = [];
        for (const p of data.products ?? []) {
          for (const v of p.variants ?? []) {
            flat.push({
              variantId: v.id,
              productId: p.id,
              name: p.name,
              variantLabel:
                [v.color, v.size].filter(Boolean).join(" / ") || null,
              sku: v.sku,
              price:
                v.priceOverride ?? p.sellingPrice ?? p.onlinePrice ?? p.mrp ?? 0,
              stock: v.stock,
            });
          }
        }
        setResults(flat);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, open]);

  const addVariant = useCallback((v: SearchVariant) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === v.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === v.variantId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `v-${v.variantId}-${prev.length}`,
          variantId: v.variantId,
          productId: v.productId,
          name: v.name,
          variantLabel: v.variantLabel,
          sku: v.sku,
          unitPrice: v.price,
          quantity: 1,
          discountType: "PERCENT",
          discountValue: 0,
        },
      ];
    });
    setSearch("");
    setResults([]);
  }, []);

  function addCustomItem() {
    setItems((prev) => [
      ...prev,
      {
        key: `cash-${prev.length}-${prev.reduce((s, i) => s + i.quantity, 0)}`,
        variantId: null,
        productId: "cash",
        name: "Custom item",
        variantLabel: null,
        sku: null,
        unitPrice: 0,
        quantity: 1,
        discountType: "PERCENT",
        discountValue: 0,
      },
    ]);
  }

  function patchLine(key: string, patch: Partial<EditLine>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeLine(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }
  function bumpQty(key: string, delta: number) {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  // Totals (mirror the server pricing).
  const subtotal = items.reduce((s, i) => s + lineGross(i), 0);
  const lineDiscountTotal = items.reduce((s, i) => s + lineDiscount(i), 0);
  const netSubtotal = subtotal - lineDiscountTotal;
  const billVal = parseFloat(billValue) || 0;
  const billDisc =
    billVal > 0
      ? Math.min(netSubtotal, billType === "FIXED" ? billVal : (netSubtotal * billVal) / 100)
      : 0;
  const total = Math.max(0, subtotal - lineDiscountTotal - billDisc);

  async function save() {
    if (items.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            variantId: i.variantId,
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            name: i.name,
            discountType: i.discountType,
            discountValue: i.discountValue || 0,
          })),
          billDiscountType: billType,
          billDiscountValue: billVal || undefined,
          customerName: name.trim() || undefined,
          customerPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.insufficient?.length) {
          const lines = data.insufficient
            .map((x: { name: string; available: number; needed: number }) =>
              `${x.name}: need ${x.needed}, ${x.available} free`)
            .join("; ");
          setError(`Not enough stock — ${lines}`);
        } else {
          setError(data?.error ?? `Failed (${res.status})`);
        }
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium bg-nate-grey-800 text-white hover:bg-nate-grey-700 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit bill
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
              <h2 className="text-base font-medium text-nate-grey-800">Edit bill</h2>
              <button
                onClick={() => !saving && setOpen(false)}
                className="text-nate-grey-400 hover:text-nate-grey-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Add items */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products to add…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-nate-grey-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-nate-grey-400" />
                )}
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-nate-grey-200 rounded-lg shadow-lg">
                    {results.map((v) => (
                      <button
                        key={v.variantId}
                        onClick={() => addVariant(v)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-nate-grey-50 flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-nate-grey-800">{v.name}</span>
                          <span className="block text-xs text-nate-grey-400">
                            {v.variantLabel ?? "—"} · {v.sku} · {v.stock} in stock
                          </span>
                        </span>
                        <span className="text-nate-grey-700 shrink-0">{inr(v.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={addCustomItem}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-50"
              >
                <Banknote className="w-3.5 h-3.5" /> Add custom item
              </button>

              {/* Line items */}
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-nate-grey-400 text-center py-6">No items.</p>
                ) : (
                  items.map((l) => (
                    <div key={l.key} className="border border-nate-grey-100 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {l.variantId ? (
                            <p className="text-sm font-medium text-nate-grey-800 truncate">{l.name}</p>
                          ) : (
                            <input
                              value={l.name}
                              onChange={(e) => patchLine(l.key, { name: e.target.value })}
                              className="text-sm font-medium text-nate-grey-800 border-b border-dashed border-nate-grey-300 focus:outline-none w-full"
                            />
                          )}
                          <p className="text-xs text-nate-grey-400">
                            {l.variantLabel ?? (l.variantId ? "—" : "Custom")}
                            {l.sku ? ` · ${l.sku}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => removeLine(l.key)}
                          className="p-1.5 rounded bg-red-50 hover:bg-red-100"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-end gap-3 mt-2">
                        {/* Qty */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 mb-1">Qty</label>
                          <div className="flex items-center gap-1">
                            <button onClick={() => bumpQty(l.key, -1)} className="w-6 h-6 rounded border border-nate-grey-200 flex items-center justify-center">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center text-sm">{l.quantity}</span>
                            <button onClick={() => bumpQty(l.key, 1)} className="w-6 h-6 rounded border border-nate-grey-200 flex items-center justify-center">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {/* Unit price */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 mb-1">Price ₹</label>
                          <input
                            type="text" inputMode="decimal"
                            min="0"
                            step="any"
                            value={l.unitPrice || ""}
                            onChange={(e) => patchLine(l.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="w-24 border border-nate-grey-200 rounded px-2 py-1 text-sm focus:outline-none"
                          />
                        </div>
                        {/* Discount */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 mb-1">Disc</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="text" inputMode="decimal"
                              min="0"
                              step="any"
                              value={l.discountValue || ""}
                              onChange={(e) => patchLine(l.key, { discountValue: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              className="w-16 border border-nate-grey-200 rounded px-2 py-1 text-sm focus:outline-none"
                            />
                            <div className="flex border border-nate-grey-200 rounded overflow-hidden">
                              {(["PERCENT", "FIXED"] as DiscountType[]).map((t) => (
                                <button
                                  key={t}
                                  onClick={() => patchLine(l.key, { discountType: t })}
                                  className={`px-2 py-1 text-xs ${l.discountType === t ? "bg-nate-grey-800 text-white" : "bg-white text-nate-grey-500"}`}
                                >
                                  {t === "PERCENT" ? "%" : "₹"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-[10px] uppercase tracking-wide text-nate-grey-400">Line</p>
                          <p className="text-sm font-medium text-nate-grey-800">
                            {inr(lineGross(l) - lineDiscount(l))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Customer */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 mb-1">Customer name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 mb-1">Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Bill discount */}
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 mb-1">Bill discount</label>
                  <input
                    type="text" inputMode="decimal"
                    min="0"
                    step="any"
                    value={billValue}
                    onChange={(e) => setBillValue(e.target.value)}
                    placeholder="0"
                    className="w-24 border border-nate-grey-200 rounded px-2 py-1 text-sm focus:outline-none"
                  />
                </div>
                <div className="flex border border-nate-grey-200 rounded overflow-hidden">
                  {(["PERCENT", "FIXED"] as DiscountType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBillType(t)}
                      className={`px-3 py-1 text-xs ${billType === t ? "bg-nate-grey-800 text-white" : "bg-white text-nate-grey-500"}`}
                    >
                      {t === "PERCENT" ? "%" : "₹"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-nate-grey-100 space-y-3">
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-nate-grey-500">
                  <span>Subtotal</span><span>{inr(subtotal)}</span>
                </div>
                {(lineDiscountTotal + billDisc) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span><span>− {inr(lineDiscountTotal + billDisc)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-nate-grey-900 text-base">
                  <span>Total</span><span>{inr(total)}</span>
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm border border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm bg-nate-grey-900 text-white hover:bg-black disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

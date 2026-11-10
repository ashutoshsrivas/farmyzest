"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ScanLine, Search, Trash2, Plus, Minus, PackageCheck, PackageX } from "lucide-react";

type Kind = "CUSTOMER" | "SUPPLIER";

interface InvVariant {
  id: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  stock: number;
  product: { name: string };
}

interface ReturnLine {
  variantId: string;
  label: string;
  sku: string;
  stock: number; // current stock, for display
  quantity: number;
}

interface SupplierOption {
  id: string;
  name: string;
}

function labelFor(name: string, size: string | null, color: string | null) {
  const variant = [color, size].filter(Boolean).join(" / ");
  return variant ? `${name} — ${variant}` : name;
}

export default function GoodsReturnForm({
  kind,
  suppliers = [],
}: {
  kind: Kind;
  suppliers?: SupplierOption[];
}) {
  const isSupplier = kind === "SUPPLIER";

  const [inventory, setInventory] = useState<InvVariant[]>([]);
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [note, setNote] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [saving, setSaving] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/inventory")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.variants) setInventory(d.variants);
      })
      .catch(() => {});
  }, []);

  const addLine = (l: Omit<ReturnLine, "quantity">) => {
    setLines((prev) => {
      const ex = prev.find((x) => x.variantId === l.variantId);
      if (ex) {
        return prev.map((x) => (x.variantId === l.variantId ? { ...x, quantity: x.quantity + 1 } : x));
      }
      return [...prev, { ...l, quantity: 1 }];
    });
  };

  const addInvVariant = (v: InvVariant) =>
    addLine({ variantId: v.id, label: labelFor(v.product.name, v.size, v.color), sku: v.sku, stock: v.stock });

  const onBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setBarcode("");
    try {
      const res = await fetch(`/api/pos/barcode?barcode=${encodeURIComponent(code)}`);
      if (!res.ok) {
        toast.error(`No item with barcode ${code}`);
        return;
      }
      const v = await res.json();
      addLine({
        variantId: v.variantId,
        label: labelFor(v.product?.name ?? "Item", v.size, v.color),
        sku: v.sku,
        stock: v.stock,
      });
    } catch {
      toast.error("Lookup failed");
    } finally {
      barcodeRef.current?.focus();
    }
  };

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return inventory
      .filter(
        (v) =>
          v.product.name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.barcode.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, inventory]);

  const setQty = (variantId: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: qty } : l))
    );

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  // Supplier returns can't take stock below zero.
  const overstockLine = isSupplier ? lines.find((l) => l.quantity > l.stock) : undefined;

  const submit = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (overstockLine) {
      toast.error(`Only ${overstockLine.stock} in stock for ${overstockLine.label}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/goods-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          supplierId: isSupplier ? supplierId || undefined : undefined,
          note: note.trim() || undefined,
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record return");
        return;
      }
      toast.success(
        isSupplier
          ? `Sent back ${totalUnits} unit${totalUnits === 1 ? "" : "s"} to supplier`
          : `Restocked ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`
      );
      setLines([]);
      setNote("");
      setSearch("");
    } catch {
      toast.error("Failed to record return");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Direction switcher — both flows are always reachable from here. */}
      <div className="inline-flex bg-nate-grey-100 rounded-lg p-1 mb-6">
        <Link
          href="/admin/goods-returns/customer"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            !isSupplier ? "bg-white text-nate-grey-900 shadow-sm" : "text-nate-grey-500 hover:text-nate-grey-800"
          }`}
        >
          By Customer
        </Link>
        <Link
          href="/admin/goods-returns/supplier"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isSupplier ? "bg-white text-nate-grey-900 shadow-sm" : "text-nate-grey-500 hover:text-nate-grey-800"
          }`}
        >
          To Supplier
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-serif">{isSupplier ? "Return to Supplier" : "Return by Customer"}</h1>
        <p className="text-sm text-nate-grey-500 mt-1">
          {isSupplier ? (
            <>
              For goods sent back to a supplier (defective, unsold, wrong delivery). Scan a barcode
              or search by name, then record it — this <strong>removes</strong> the stock. No
              debit-note is tracked here.
            </>
          ) : (
            <>
              For items a customer brings back (incl. off-platform Instagram / WhatsApp sales). Scan
              a barcode or search by name, then record the return — this puts the stock back. No
              refund is tracked.
            </>
          )}
        </p>
      </div>

      {/* Supplier picker */}
      {isSupplier && (
        <div className="bg-white rounded-lg p-5 border border-nate-grey-200 mb-6">
          <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full border border-nate-grey-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          >
            <option value="">— Not specified —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-nate-grey-400 mt-1.5">Optional — pick who the goods went back to.</p>
        </div>
      )}

      {/* Lookup */}
      <div className="bg-white rounded-lg p-5 border border-nate-grey-200 space-y-4">
        <form onSubmit={onBarcodeSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <ScanLine className="w-4 h-4 text-nate-grey-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan / type barcode, press Enter"
              className="w-full border border-nate-grey-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 text-sm bg-nate-grey-800 text-white rounded-lg hover:bg-nate-grey-700"
          >
            Add
          </button>
        </form>

        <div className="relative">
          <Search className="w-4 h-4 text-nate-grey-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="…or search by product name / SKU"
            className="w-full border border-nate-grey-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          />
          {matches.length > 0 && (
            <div className="mt-2 border border-nate-grey-200 rounded-lg divide-y divide-nate-grey-100 overflow-hidden">
              {matches.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addInvVariant(v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-nate-grey-50"
                >
                  <span className="text-nate-grey-800">{labelFor(v.product.name, v.size, v.color)}</span>
                  <span className="text-xs text-nate-grey-400 font-mono">
                    {v.sku} · {v.stock} in stock
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items being returned */}
      <div className="bg-white rounded-lg border border-nate-grey-200 mt-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-nate-grey-100 text-sm font-medium text-nate-grey-700">
          Items to return {totalUnits > 0 && <span className="text-nate-grey-400">({totalUnits} units)</span>}
        </div>
        {lines.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-nate-grey-400">
            Nothing added yet — scan or search above.
          </div>
        ) : (
          <ul className="divide-y divide-nate-grey-100">
            {lines.map((l) => {
              const next = isSupplier ? l.stock - l.quantity : l.stock + l.quantity;
              const over = isSupplier && l.quantity > l.stock;
              return (
                <li key={l.variantId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-nate-grey-800 truncate">{l.label}</p>
                    <p className={`text-xs font-mono ${over ? "text-red-600" : "text-nate-grey-400"}`}>
                      {l.sku} · {l.stock} → {next}
                      {over ? " (not enough stock)" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQty(l.variantId, l.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center border border-nate-grey-200 rounded hover:bg-nate-grey-50"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">{l.quantity}</span>
                    <button
                      onClick={() => setQty(l.variantId, l.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center border border-nate-grey-200 rounded hover:bg-nate-grey-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setQty(l.variantId, 0)}
                    className="text-nate-grey-400 hover:text-red-600 p-1"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Note + submit */}
      <div className="mt-6 space-y-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isSupplier
              ? "Note (optional) — e.g. defective batch, debit-note #"
              : "Note (optional) — e.g. Instagram sale, customer name"
          }
          className="w-full border border-nate-grey-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
        <button
          onClick={submit}
          disabled={saving || lines.length === 0 || !!overstockLine}
          className="w-full flex items-center justify-center gap-2 bg-nate-grey-800 text-white py-3 rounded-lg font-medium hover:bg-nate-grey-700 disabled:opacity-50"
        >
          {isSupplier ? <PackageX className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
          {saving
            ? "Recording…"
            : isSupplier
              ? "Record return to supplier & remove stock"
              : "Record return & restock"}
        </button>
      </div>
    </div>
  );
}

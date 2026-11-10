"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface Variant {
  id: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  stock: number;
  lowStockThreshold: number;
  product: { name: string };
}

export function InventoryAlerts({ variants }: { variants: Variant[] }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <h2 className="text-sm font-semibold text-red-800">
          Low Stock Alerts ({variants.length})
        </h2>
      </div>
      <div className="space-y-2">
        {variants.map((v) => (
          <div key={v.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-nate-grey-500 bg-nate-grey-100 px-2 py-0.5 rounded">
                {v.sku}
              </span>
              <div>
                <p className="text-sm font-medium text-nate-grey-800">{v.product.name}</p>
                <p className="text-xs text-nate-grey-500">
                  {v.size && <span>Size: {v.size}</span>}
                  {v.size && v.color && " · "}
                  {v.color && <span>Color: {v.color}</span>}
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-red-600">
              {v.stock} / {v.lowStockThreshold} units
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InventoryTable({ variants }: { variants: Variant[] }) {
  const [updates, setUpdates] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleStockChange(variantId: string, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setUpdates((prev) => ({ ...prev, [variantId]: num }));
    }
  }

  async function handleBulkUpdate() {
    const pending = Object.entries(updates);
    if (pending.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = pending.map(([variantId, stock]) => ({ variantId, stock }));
      const res = await fetch("/api/admin/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: payload }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Stock updated successfully." });
        setUpdates({});
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update stock." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-nate-grey-700">All Variants</h2>
        {Object.keys(updates).length > 0 && (
          <button
            onClick={handleBulkUpdate}
            disabled={saving}
            className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : `Update ${Object.keys(updates).length} variant${Object.keys(updates).length > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {message && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-nate-grey-100 bg-nate-grey-50">
            <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Product</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Variant</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">SKU</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Barcode</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Stock</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Threshold</th>
            <th className="text-center px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Adjust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nate-grey-100">
          {variants.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-nate-grey-500">
                No variants found.
              </td>
            </tr>
          ) : (
            variants.map((v) => {
              const isLow = v.stock <= v.lowStockThreshold;
              const pendingUpdate = updates[v.id] !== undefined;
              return (
                <tr key={v.id} className={`hover:bg-nate-grey-50 transition-colors ${isLow ? "bg-red-50" : ""}`}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-nate-grey-800">{v.product.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-nate-grey-700">
                      {v.size && <span className="font-mono text-xs">Size: {v.size}</span>}
                      {v.size && v.color && <span className="text-nate-grey-300 mx-1">·</span>}
                      {v.color && <span className="font-mono text-xs">Color: {v.color}</span>}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-nate-grey-500 bg-nate-grey-100 px-2 py-0.5 rounded">
                      {v.sku}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-nate-grey-500">
                    {v.barcode}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${isLow ? "text-red-600" : "text-nate-grey-800"}`}>
                      {v.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-nate-grey-500">
                    {v.lowStockThreshold}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="text" inputMode="decimal"
                        min="0"
                        placeholder={String(v.stock)}
                        value={updates[v.id] !== undefined ? updates[v.id] : ""}
                        onChange={(e) => handleStockChange(v.id, e.target.value)}
                        className={`w-20 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-nate-grey-400 ${
                          pendingUpdate ? "border-accent bg-accent/5" : "border-nate-grey-200"
                        }`}
                      />
                      {pendingUpdate && (
                        <span className="text-xs text-accent font-medium">Set</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
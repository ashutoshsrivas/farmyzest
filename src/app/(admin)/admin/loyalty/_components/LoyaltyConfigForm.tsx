"use client";

import { useState } from "react";

interface LoyaltyConfig {
  id: string;
  pointsPer100Rupees: number;
  rupeeValuePerPoint: number;
  minRedeemAmount: number;
  isActive: boolean;
}

export function LoyaltyConfigForm({ config }: { config: LoyaltyConfig | null }) {
  const [form, setForm] = useState({
    pointsPer100Rupees: config?.pointsPer100Rupees ?? 1,
    rupeeValuePerPoint: config?.rupeeValuePerPoint ?? 0.25,
    minRedeemAmount: config?.minRedeemAmount ?? 100,
    isActive: config?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      // /api/admin/loyalty PUT finds-or-creates the single config row, so no id
      // is needed (the old /api/loyalty/config PUT required one we never sent).
      const res = await fetch("/api/admin/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Configuration saved." });
      } else {
        setMessage({ type: "error", text: "Failed to save configuration." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-nate-grey-700 mb-1">
          Points earned per Rs.100 spent
        </label>
        <input
          type="text" inputMode="decimal"
          min="0.1"
          step="0.1"
          value={form.pointsPer100Rupees}
          onChange={(e) => setForm((prev) => ({ ...prev, pointsPer100Rupees: parseFloat(e.target.value) || 0 }))}
          className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
        <p className="text-xs text-nate-grey-400 mt-1">
          Currently: 1 point per Rs.{Math.round(100 / form.pointsPer100Rupees)} spent
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-nate-grey-700 mb-1">
          Rupee value per point (in Rs.)
        </label>
        <input
          type="text" inputMode="decimal"
          min="0.01"
          step="0.01"
          value={form.rupeeValuePerPoint}
          onChange={(e) => setForm((prev) => ({ ...prev, rupeeValuePerPoint: parseFloat(e.target.value) || 0 }))}
          className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
        <p className="text-xs text-nate-grey-400 mt-1">
          1 point = Rs.{form.rupeeValuePerPoint} redemption value
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-nate-grey-700 mb-1">
          Minimum redeem amount (Rs.)
        </label>
        <input
          type="text" inputMode="decimal"
          min="0"
          step="1"
          value={form.minRedeemAmount}
          onChange={(e) => setForm((prev) => ({ ...prev, minRedeemAmount: parseFloat(e.target.value) || 0 }))}
          className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
        <p className="text-xs text-nate-grey-400 mt-1">
          Cart must be at least ₹{form.minRedeemAmount} before points can be redeemed
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-nate-grey-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          className="w-4 h-4 rounded border-nate-grey-300"
        />
        Enable loyalty program
      </label>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Configuration"}
      </button>
    </form>
  );
}
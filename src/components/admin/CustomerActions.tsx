"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Minus, Wallet } from "lucide-react";

// Admin controls on the customer detail page: adjust loyalty points (with a
// reason) and enable/disable the account. PATCHes /api/admin/customers/[id]
// then refreshes the server component.

export function CustomerActions({
  customerId,
  initialPoints,
  initialActive,
  initialWalletBalance = 0,
  walletEligible = false,
}: {
  customerId: string;
  initialPoints: number;
  initialActive: boolean;
  initialWalletBalance?: number;
  walletEligible?: boolean;
}) {
  const router = useRouter();
  const [points, setPoints] = useState(initialPoints);
  const [active, setActive] = useState(initialActive);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Wallet (store credit) adjustment.
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [walletDelta, setWalletDelta] = useState("");
  const [walletNote, setWalletNote] = useState("");

  async function patch(bodyObj: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? `Failed (${res.status})`);
        return null;
      }
      return data.customer as {
        loyaltyPoints: number;
        isActive: boolean;
        walletBalance?: number;
      };
    } catch {
      setErr("Network error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function applyWalletDelta(sign: 1 | -1) {
    const n = parseFloat(walletDelta);
    if (!isFinite(n) || n <= 0) {
      setErr("Enter a positive store-credit amount");
      return;
    }
    const c = await patch({ walletDelta: sign * n, walletNote: walletNote || undefined });
    if (c) {
      if (typeof c.walletBalance === "number") setWalletBalance(c.walletBalance);
      setWalletDelta("");
      setWalletNote("");
      router.refresh();
    }
  }

  async function applyDelta(sign: 1 | -1) {
    const n = parseFloat(delta);
    if (!isFinite(n) || n <= 0) {
      setErr("Enter a positive number of points");
      return;
    }
    const c = await patch({ loyaltyDelta: sign * n, loyaltyNote: note || undefined });
    if (c) {
      setPoints(c.loyaltyPoints);
      setDelta("");
      setNote("");
      router.refresh();
    }
  }

  async function toggleActive() {
    const c = await patch({ isActive: !active });
    if (c) {
      setActive(c.isActive);
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
        <h2 className="text-base font-medium text-nate-grey-800">Loyalty &amp; account</h2>
        <button
          onClick={toggleActive}
          disabled={busy}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 ${
            active
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {active ? "Disable account" : "Enable account"}
        </button>
      </div>
      <div className="px-6 py-4 space-y-4">
        <div>
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Loyalty points</p>
          <p className="text-2xl font-serif text-nate-grey-900">{Math.round(points)}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="block">
            <span className="block text-xs text-nate-grey-600 mb-1">Adjust by</span>
            <input
              type="text" inputMode="decimal"
              min="0"
              step="1"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 50"
              className="w-28 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/50 outline-none"
            />
          </label>
          <label className="block flex-1">
            <span className="block text-xs text-nate-grey-600 mb-1">Reason (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. goodwill credit"
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/50 outline-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => applyDelta(1)}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-nate-grey-900 text-white text-sm hover:bg-black disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
            <button
              onClick={() => applyDelta(-1)}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-nate-grey-300 text-nate-grey-700 text-sm hover:bg-nate-grey-50 disabled:opacity-50"
            >
              <Minus className="w-4 h-4" />
              Deduct
            </button>
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}

        {/* Store credit (wallet) adjustment */}
        <div className="border-t border-nate-grey-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-nate-grey-500 uppercase tracking-wide flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Store credit
            </p>
            <p className="text-lg font-serif text-nate-grey-900">
              ₹{walletBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          {walletEligible ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end mt-3">
              <label className="block">
                <span className="block text-xs text-nate-grey-600 mb-1">Amount ₹</span>
                <input
                  type="text" inputMode="decimal"
                  min="0"
                  step="1"
                  value={walletDelta}
                  onChange={(e) => setWalletDelta(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-28 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/50 outline-none"
                />
              </label>
              <label className="block flex-1">
                <span className="block text-xs text-nate-grey-600 mb-1">Reason (optional)</span>
                <input
                  value={walletNote}
                  onChange={(e) => setWalletNote(e.target.value)}
                  placeholder="e.g. goodwill credit"
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/50 outline-none"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => applyWalletDelta(1)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-nate-grey-900 text-white text-sm hover:bg-black disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
                <button
                  onClick={() => applyWalletDelta(-1)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-nate-grey-300 text-nate-grey-700 text-sm hover:bg-nate-grey-50 disabled:opacity-50"
                >
                  <Minus className="w-4 h-4" />
                  Deduct
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-nate-grey-400 mt-2">
              Add a 10-digit phone to this customer to manage store credit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

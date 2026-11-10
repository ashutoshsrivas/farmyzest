"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Marks a partial order's remaining balance as collected (on delivery).
export function CollectBalanceButton({ orderId, amount }: { orderId: string; amount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function collect() {
    if (!confirm(`Mark ₹${amount.toFixed(2)} balance as collected? This closes the payment.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectBalance: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Failed to update");
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-2">
      <button
        onClick={collect}
        disabled={busy}
        className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {busy ? "Saving…" : `Mark ₹${amount.toFixed(2)} balance collected`}
      </button>
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
    </div>
  );
}

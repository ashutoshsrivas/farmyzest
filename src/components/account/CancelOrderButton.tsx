"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Small client-side widget posted onto the customer order detail page when
// the order is in a cancellable state (PENDING/PROCESSING). Sends a POST to
// /api/orders/[id]/cancel and reloads the page so the new status is visible.

interface Props {
  orderId: string;
}

export function CancelOrderButton({ orderId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!confirm("Cancel this order? Stock will be restored. This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-nate-grey-100">
        <h2 className="text-lg font-serif text-nate-grey-800">Need to cancel?</h2>
      </div>
      <div className="px-6 py-4">
        <p className="text-sm text-nate-grey-600 mb-3">
          You can cancel this order while it's still being prepared. Once it
          ships you'll need to use the returns flow instead.
        </p>
        <button
          onClick={onClick}
          disabled={busy}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {busy ? "Cancelling…" : "Cancel order"}
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

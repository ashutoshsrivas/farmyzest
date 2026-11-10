"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Small modal-style widget for DELIVERED orders only. Calls /api/returns
// which creates a Return row in REQUESTED state for admin to approve later.

interface Props {
  orderId: string;
  orderTotal: number;
}

export function RequestReturnButton({ orderId, orderTotal }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) {
      setError("Please give a reason of at least 5 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason, notes: notes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-nate-grey-100">
        <h2 className="text-lg font-serif text-nate-grey-800">Returns</h2>
      </div>
      <div className="px-6 py-4">
        {done ? (
          <p className="text-sm text-green-700">
            Return requested. We'll email you once it's approved.
          </p>
        ) : open ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-nate-grey-700 mb-1">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What was wrong with this order?"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-nate-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-nate-grey-700 mb-1">
                Additional notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-nate-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <p className="text-xs text-nate-grey-500">
              Refund amount: ₹{orderTotal.toFixed(2)} (full order value — admin
              may adjust)
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 text-sm rounded-lg border border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-50"
              >
                Never mind
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-nate-grey-800 text-white hover:bg-nate-grey-700 disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Request return"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-nate-grey-600 mb-3">
              Not what you expected? Request a return within 7 days of delivery.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-nate-grey-100 text-nate-grey-800 hover:bg-nate-grey-200 transition-colors"
            >
              Request return
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { ALL_ORDER_STATUSES, deductsStock } from "@/lib/order-status";

// Inline status changer for the admin order-detail header. Shows the current
// status as a pill that opens a dropdown of allowed next states; on pick it
// PATCHes /api/admin/orders/[id] and refreshes the server component so the
// rest of the page (stock effects, badges) reflect the change.
//
// Stock model: items are deducted from inventory only when the order enters a
// fulfilment status (Shipped / Out for delivery / Delivered) and returned when
// it leaves those. Each option is labelled with its stock effect so the person
// changing status knows exactly what will happen.

const STATUSES = ALL_ORDER_STATUSES;

// Human label + its inventory effect, shown right in the dropdown.
function optionLabel(s: string): string {
  const pretty = s.replace(/_/g, " ");
  if (deductsStock(s)) return `${pretty} · deducts stock`;
  if (s === "CANCELLED" || s === "RETURNED") return `${pretty} · returns stock`;
  return `${pretty} · holds no stock`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  SHIPPED: "bg-purple-100 text-purple-700 border-purple-200",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700 border-indigo-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  RETURNED: "bg-orange-100 text-orange-700 border-orange-200",
};

export function OrderStatusControl({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === status || busy) return;

    // Always confirm a status change so it's never accidental. When the change
    // also moves stock, spell that out (deducting = entering a fulfilment status
    // from one that held no stock; returning = leaving fulfilment, e.g. cancel /
    // return / back to processing). Cancelling snaps the <select> back to the
    // current status (it's controlled by `status`, which we don't touch here).
    const pretty = next.replace(/_/g, " ");
    const wasDeduct = deductsStock(status);
    const willDeduct = deductsStock(next);
    let warn = `Change order status to ${pretty}?`;
    if (willDeduct && !wasDeduct) {
      warn = `Change order status to ${pretty}? Item stock will be DEDUCTED from inventory.`;
    } else if (!willDeduct && wasDeduct) {
      warn = `Change order status to ${pretty}? Item stock will be RETURNED to inventory.`;
    }
    if (!confirm(warn)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      setStatus(next);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-2">
      <label className="text-xs text-nate-grey-500">Status</label>
      <div className="relative">
        <select
          value={status}
          onChange={(e) => change(e.target.value)}
          disabled={busy}
          className={`appearance-none text-xs font-medium pl-3 pr-8 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60 ${
            STATUS_COLORS[status] ?? "bg-nate-grey-100 text-nate-grey-600 border-nate-grey-200"
          }`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {optionLabel(s)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-nate-grey-500" />
          ) : (
            <Check className="w-3.5 h-3.5 text-nate-grey-400" />
          )}
        </span>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
      <p className="text-[10px] text-nate-grey-400 max-w-[240px] text-right leading-tight">
        Stock is deducted at Shipped / Out for delivery / Delivered, and returned
        if the order goes back or is cancelled.
      </p>
    </div>
  );
}

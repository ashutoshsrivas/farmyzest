"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

const STATUSES = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;
type BillStatus = (typeof STATUSES)[number];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

// Editable status pill on the bill detail page. Changing it PATCHes the bill —
// no stock/line-item side effects, just the payment status.
export function BillStatusControl({ billId, current }: { billId: string; current: BillStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<BillStatus>(current);
  const [saving, setSaving] = useState(false);

  async function change(next: BillStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/purchases?id=${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(prev); // revert on failure
        alert("Could not update status. Please try again.");
      } else {
        router.refresh();
      }
    } catch {
      setStatus(prev);
      alert("Network error updating status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => change(e.target.value as BillStatus)}
        aria-label="Payment status"
        className={`text-xs px-2.5 py-1.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          STATUS_COLORS[status] ?? "bg-nate-grey-100 text-nate-grey-600"
        }`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-nate-grey-400" />}
    </span>
  );
}

// Delete a bill. `redirectTo` sends the user to the list after a detail-page
// delete; on the list itself we just refresh. Reverses the stock the bill added.
export function DeleteBillButton({
  billId,
  billNumber,
  variant = "icon",
  redirectTo,
}: {
  billId: string;
  billNumber: string;
  variant?: "icon" | "button";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const ok = window.confirm(
      `Delete bill ${billNumber}?\n\nThe stock this bill added will be removed from inventory, and its recorded payments deleted. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/purchases?id=${billId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to delete bill.");
        setBusy(false);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        startTransition(() => router.refresh());
        setBusy(false);
      }
    } catch {
      alert("Network error deleting bill.");
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50 disabled:opacity-50"
      >
        {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={disabled}
      title={`Delete bill ${billNumber}`}
      aria-label={`Delete bill ${billNumber}`}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-nate-grey-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );
}

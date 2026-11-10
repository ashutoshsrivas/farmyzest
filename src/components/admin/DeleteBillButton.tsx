"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

// Permanently delete a bill/order from the admin order-detail page. This is a
// destructive, irreversible action, so it's gated behind an explicit confirm
// modal that spells out the reversals. On success it returns to the orders list.
export function DeleteBillButton({
  orderId,
  orderRef,
}: {
  orderId: string;
  orderRef: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? `Failed to delete (${res.status})`);
        setBusy(false);
        return;
      }
      toast.success(`Bill ${orderRef} deleted`);
      router.push("/admin/orders");
      router.refresh();
    } catch {
      toast.error("Network error — please retry.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete bill
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-nate-grey-900">Delete bill {orderRef}?</h3>
                <p className="text-sm text-nate-grey-500 mt-1">
                  This permanently removes the order. It will also:
                </p>
                <ul className="text-sm text-nate-grey-600 mt-2 list-disc pl-5 space-y-0.5">
                  <li>put its items back into stock (if already deducted),</li>
                  <li>reverse any wallet redemption and loyalty points.</li>
                </ul>
                <p className="text-xs text-nate-grey-400 mt-2">
                  Bills with exchanges or returns can&apos;t be deleted — undo those first.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-nate-grey-700 hover:text-black disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

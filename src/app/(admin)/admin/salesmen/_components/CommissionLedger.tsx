"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  paidAt: string; // ISO
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const todayIso = () => new Date().toISOString().split("T")[0];

export function CommissionLedger({
  salesmanId,
  salesmanName,
  earned,
  paid,
  pending,
  payments,
}: {
  salesmanId: string;
  salesmanName: string;
  earned: number;
  paid: number;
  pending: number;
  payments: Payment[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    method: "CASH",
    reference: "",
    note: "",
    paidAt: todayIso(),
  });

  // Datewise filter for the ledger view.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const visible = useMemo(() => {
    return payments.filter((p) => {
      const d = p.paidAt.split("T")[0];
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [payments, from, to]);

  const visibleTotal = visible.reduce((s, p) => s + p.amount, 0);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/salesmen/${salesmanId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: form.method,
          reference: form.reference.trim() || undefined,
          note: form.note.trim() || undefined,
          paidAt: form.paidAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't record payment");
        return;
      }
      toast.success(`Recorded ${inr(amount)} to ${salesmanName}`);
      setForm({ amount: "", method: "CASH", reference: "", note: "", paidAt: todayIso() });
      setShowForm(false);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this payout entry? The pending amount will go back up.")) return;
    try {
      const res = await fetch(`/api/admin/salesmen/${salesmanId}/payments?paymentId=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete");
        return;
      }
      toast.success("Payout removed");
      router.refresh();
    } catch {
      toast.error("Network error");
    }
  }

  const inputCls =
    "w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400";

  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 overflow-hidden">
      {/* Header + record button */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-nate-grey-100">
        <div>
          <h2 className="text-base font-medium text-nate-grey-800">Commission Ledger</h2>
          <p className="text-xs text-nate-grey-500">
            Earned {inr(earned)} · Paid {inr(paid)} ·{" "}
            <span className={pending > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
              Pending {inr(pending)}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 bg-nate-grey-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-nate-grey-700"
        >
          <Plus className="w-4 h-4" /> Record payment
        </button>
      </div>

      {/* Record form */}
      {showForm && (
        <form onSubmit={record} className="px-5 py-4 border-b border-nate-grey-100 bg-nate-grey-50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Amount ₹</label>
              <input type="text" inputMode="decimal" min="0" step="any" value={form.amount} autoFocus
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={pending > 0 ? String(Math.round(pending)) : "0"} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Method</label>
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className={inputCls}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Date</label>
              <input type="date" value={form.paidAt} max={todayIso()} onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Reference</label>
              <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="txn / cheque #" className={inputCls} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Note</label>
                <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="optional" className={inputCls} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="submit" disabled={saving}
              className="bg-nate-grey-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save payment"}
            </button>
            {pending > 0 && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, amount: String(Math.round(pending * 100) / 100) }))}
                className="text-xs text-nate-grey-500 hover:text-nate-grey-800">
                Pay full pending ({inr(pending)})
              </button>
            )}
          </div>
        </form>
      )}

      {/* Datewise filter */}
      <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-nate-grey-100">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">From</label>
          <input type="date" value={from} max={to || todayIso()} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">To</label>
          <input type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs text-nate-grey-500 hover:text-nate-grey-800 pb-2">
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-nate-grey-500 pb-2">
          {visible.length} payout{visible.length === 1 ? "" : "s"} · {inr(visibleTotal)}
        </span>
      </div>

      {/* Ledger */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-nate-grey-50 border-b border-nate-grey-100">
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Date</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Method</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Reference / Note</th>
              <th className="text-right px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Amount</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-nate-grey-400">
                  No payouts {from || to ? "in this range" : "yet"}.
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id} className="hover:bg-nate-grey-50">
                  <td className="px-5 py-3 text-nate-grey-700 whitespace-nowrap">
                    {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-nate-grey-600">{p.method}</td>
                  <td className="px-5 py-3 text-nate-grey-600">
                    {[p.reference, p.note].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-nate-grey-800 tabular-nums">{inr(p.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => remove(p.id)} className="text-nate-grey-400 hover:text-red-600 p-1" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

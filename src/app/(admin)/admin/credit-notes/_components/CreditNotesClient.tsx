"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, StickyNote, Search, Check } from "lucide-react";
import toast from "react-hot-toast";

type CustomerHit = { id: string | null; name: string; phone: string; email: string };

type CreditNote = {
  id: string;
  name: string;
  phone: string;
  amount: number;
  note: string | null;
  createdAt: string;
  redeemedAt: string | null;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function CreditNotesClient({ notes }: { notes: CreditNote[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", amount: "", note: "" });
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Customer search → link the note to an existing account (fills name + phone).
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [showHits, setShowHits] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/customer-search?q=${encodeURIComponent(q)}`);
        const d = await res.json();
        if (!cancelled) setHits(res.ok ? d.customers ?? [] : []);
      } catch {
        if (!cancelled) setHits([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  function pickCustomer(c: CustomerHit) {
    setForm((f) => ({ ...f, name: c.name || f.name, phone: c.phone || f.phone }));
    setLinkedUserId(c.id);
    setSearch(c.name || c.phone || "");
    setHits([]);
    setShowHits(false);
  }

  // "Available" = not yet redeemed into a wallet. Redeemed notes stay listed
  // (as Used) for the record but don't count toward the outstanding total.
  const available = notes.filter((n) => !n.redeemedAt).reduce((s, n) => s + n.amount, 0);
  const amountNum = parseFloat(form.amount);
  const canSubmit =
    !saving && form.name.trim() && form.phone.trim() && isFinite(amountNum) && amountNum > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          amount: amountNum,
          note: form.note.trim() || null,
          userId: linkedUserId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? `Failed (${res.status})`);
        setSaving(false);
        return;
      }
      toast.success("Credit note added");
      setForm({ name: "", phone: "", amount: "", note: "" });
      setLinkedUserId(null);
      setSearch("");
      router.refresh();
    } catch {
      toast.error("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this credit note?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/credit-notes?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete");
        setDeletingId(null);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    } catch {
      toast.error("Network error — please retry.");
      setDeletingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Add form */}
      <div className="lg:col-span-1">
        <form onSubmit={submit} className="bg-white rounded-xl p-5 space-y-4 sticky top-6">
          <h2 className="text-base font-medium text-nate-grey-800 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New credit note
          </h2>

          {/* Search & link an existing customer (fills name + phone). */}
          <div className="relative">
            <label className="block text-xs font-medium text-nate-grey-600 mb-1">
              Link customer <span className="text-nate-grey-400">(search name / phone)</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-nate-grey-400 absolute left-2.5 top-2.5" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowHits(true);
                  setLinkedUserId(null);
                }}
                onFocus={() => setShowHits(true)}
                onBlur={() => setTimeout(() => setShowHits(false), 150)}
                className="w-full border border-nate-grey-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                placeholder="Search existing customer"
              />
            </div>
            {linkedUserId && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Linked to this customer&apos;s account
              </p>
            )}
            {showHits && search.trim().length >= 2 && hits.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-nate-grey-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {hits.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }}
                    className="block w-full text-left px-3 py-2 hover:bg-nate-grey-50 border-b border-nate-grey-100 last:border-0"
                  >
                    <div className="text-sm font-medium text-nate-grey-800">{c.name || c.phone || c.email}</div>
                    <div className="text-xs text-nate-grey-400">
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                      {c.id ? "" : " · walk-in"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-nate-grey-600 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="Customer name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-nate-grey-600 mb-1">Phone number</label>
            <input
              value={form.phone}
              inputMode="tel"
              onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setLinkedUserId(null); }}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="10-digit mobile"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-nate-grey-600 mb-1">Amount (₹)</label>
            <input
              value={form.amount}
              inputMode="decimal"
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-nate-grey-600 mb-1">
              Note <span className="text-nate-grey-400">(optional)</span>
            </label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="Reason / reference"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : "Add credit note"}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
            <h2 className="text-base font-medium text-nate-grey-800">
              Credit notes ({notes.length})
            </h2>
            <span className="text-sm text-nate-grey-500">
              Available <span className="font-semibold text-nate-grey-800">{inr(available)}</span>
            </span>
          </div>
          {notes.length === 0 ? (
            <div className="p-12 text-center text-nate-grey-500">
              <StickyNote className="w-8 h-8 mx-auto mb-3 text-nate-grey-300" />
              No credit notes yet. Add one on the left.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-nate-grey-500 border-b border-nate-grey-100">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Note</th>
                    <th className="px-5 py-3 font-medium text-right">Amount</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-nate-grey-100">
                  {notes.map((n) => (
                    <tr key={n.id} className={`hover:bg-nate-grey-50 ${n.redeemedAt ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3 text-nate-grey-500 whitespace-nowrap">{fmtDate(n.createdAt)}</td>
                      <td className="px-5 py-3 font-medium text-nate-grey-800">
                        <span className="inline-flex items-center gap-2">
                          {n.name}
                          {n.redeemedAt && (
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-nate-grey-100 text-nate-grey-500">
                              Used
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-nate-grey-600 font-mono">{n.phone}</td>
                      <td className="px-5 py-3 text-nate-grey-500">{n.note || "—"}</td>
                      <td className={`px-5 py-3 text-right tabular-nums font-medium ${n.redeemedAt ? "text-nate-grey-400 line-through" : "text-nate-grey-800"}`}>{inr(n.amount)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => remove(n.id)}
                          disabled={deletingId === n.id}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                          aria-label="Delete credit note"
                        >
                          {deletingId === n.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, X } from "lucide-react";

interface Salesman {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  commissionRate: number;
  isActive: boolean;
  pending?: number;
  _count: { orders: number };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function SalesmenTable({
  salesmen,
  totalPosOrders,
}: {
  salesmen: Salesman[];
  totalPosOrders: number;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Salesman | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    commissionRate: 0,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function openAdd() {
    setEditTarget(null);
    setForm({ name: "", phone: "", email: "", commissionRate: 0, isActive: true });
    setMessage(null);
    setShowModal(true);
  }

  function openEdit(s: Salesman) {
    setEditTarget(s);
    setForm({
      name: s.name,
      phone: s.phone || "",
      email: s.email || "",
      commissionRate: s.commissionRate,
      isActive: s.isActive,
    });
    setMessage(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const url = editTarget ? `/api/salesmen/${editTarget.id}` : "/api/salesmen";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: editTarget ? "Salesman updated." : "Salesman created." });
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
          <div className="text-sm text-nate-grey-500">
            {salesmen.length} salesmen · {totalPosOrders} total POS orders
          </div>
          <button
            onClick={openAdd}
            className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Salesman
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nate-grey-100 bg-nate-grey-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Email</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Commission</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Orders</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Pending</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {salesmen.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-nate-grey-500">
                  No salesmen yet.
                </td>
              </tr>
            ) : (
              salesmen.map((s) => (
                <tr key={s.id} className="hover:bg-nate-grey-50 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/admin/salesmen/${s.id}`} className="text-nate-grey-800 hover:text-accent hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-nate-grey-600">{s.phone || "—"}</td>
                  <td className="px-6 py-4 text-nate-grey-600">{s.email || "—"}</td>
                  <td className="px-6 py-4 text-right text-nate-grey-800">{s.commissionRate}%</td>
                  <td className="px-6 py-4 text-center text-nate-grey-600">{s._count.orders}</td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    {s.pending && s.pending > 0 ? (
                      <span className="text-amber-600 font-medium">{inr(s.pending)}</span>
                    ) : (
                      <span className="text-nate-grey-400">{inr(0)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-nate-grey-100 text-nate-grey-500"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-nate-grey-400 hover:text-accent transition-colors p-1"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-lg font-serif text-nate-grey-800">
                {editTarget ? "Edit Salesman" : "New Salesman"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-nate-grey-400 hover:text-nate-grey-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {message && (
                <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder="Rajesh Kumar"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                    placeholder="+91 98XXX XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                    placeholder="rajesh@store.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Commission Rate (%)</label>
                <input
                  type="text" inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.commissionRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, commissionRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-nate-grey-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-nate-grey-300"
                />
                Active
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : editTarget ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
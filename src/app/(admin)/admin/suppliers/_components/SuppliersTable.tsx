"use client";

import { useState } from "react";
import { Plus, Pencil, X, IndianRupee } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  balance: number;
  isActive: boolean;
  _count: { bills: number };
}

interface Props {
  suppliers: Supplier[];
  totalPayable: number;
}

export function SuppliersTable({ suppliers, totalPayable }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [payTarget, setPayTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
  });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH", reference: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function openAdd() {
    setEditTarget(null);
    setForm({ name: "", phone: "", email: "", address: "", gstin: "" });
    setMessage(null);
    setShowModal(true);
  }

  function openEdit(s: Supplier) {
    setEditTarget(s);
    setForm({
      name: s.name,
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      gstin: s.gstin || "",
    });
    setMessage(null);
    setShowModal(true);
  }

  function openPayment(s: Supplier) {
    setPayTarget(s);
    setPaymentForm({ amount: "", method: "CASH", reference: "" });
    setMessage(null);
    setShowPaymentModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const url = editTarget ? `/api/suppliers/${editTarget.id}` : "/api/suppliers";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: editTarget ? "Supplier updated." : "Supplier created." });
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

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/suppliers/${payTarget.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Payment recorded." });
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to record payment." });
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
            {suppliers.length} suppliers
            {totalPayable > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                Rs.{totalPayable.toLocaleString("en-IN")} outstanding
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nate-grey-100 bg-nate-grey-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">GSTIN</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Balance</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-nate-grey-500">
                  No suppliers yet.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-nate-grey-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-nate-grey-800">{s.name}</td>
                  <td className="px-6 py-4 text-nate-grey-600">{s.phone || "—"}</td>
                  <td className="px-6 py-4 text-nate-grey-600">{s.email || "—"}</td>
                  <td className="px-6 py-4 font-mono text-xs text-nate-grey-500">{s.gstin || "—"}</td>
                  <td className={`px-6 py-4 text-right font-medium ${s.balance > 0 ? "text-red-600" : "text-green-700"}`}>
                    Rs.{Math.abs(s.balance).toLocaleString("en-IN")}
                    {s.balance < 0 ? " (credit)" : s.balance > 0 ? " payable" : ""}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-nate-grey-100 text-nate-grey-500"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {s.balance > 0 && (
                        <button
                          onClick={() => openPayment(s)}
                          className="text-nate-grey-400 hover:text-green-600 transition-colors p-1"
                          title="Record payment"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(s)}
                        className="text-nate-grey-400 hover:text-accent transition-colors p-1"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-lg font-serif text-nate-grey-800">
                {editTarget ? "Edit Supplier" : "New Supplier"}
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
                  placeholder="Supplier Name"
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
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  rows={2}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400 font-mono uppercase"
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>

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

      {/* Record Payment Modal */}
      {showPaymentModal && payTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-lg font-serif text-nate-grey-800">
                Record Payment — {payTarget.name}
              </h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-nate-grey-400 hover:text-nate-grey-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              {message && (
                <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Amount (Rs.)</label>
                <input
                  type="text" inputMode="decimal"
                  required
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder={`Max: Rs.${payTarget.balance.toLocaleString("en-IN")}`}
                />
                <p className="text-xs text-nate-grey-400 mt-1">
                  Outstanding balance: Rs.{payTarget.balance.toLocaleString("en-IN")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Reference / Notes</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder="UPI reference, cheque number, etc."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
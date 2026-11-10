// src/app/(admin)/admin/taxes/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";

interface TaxSlab {
  id: string;
  name: string;
  percentage: number;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type SortKey = "name" | "percentage";

export default function TaxesPage() {
  const [slabs, setSlabs] = useState<TaxSlab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("percentage");
  const [sortAsc, setSortAsc] = useState(true);

  const [form, setForm] = useState({
    name: "",
    percentage: "",
    minAmount: "",
    maxAmount: "",
    isActive: true,
  });

  useEffect(() => {
    fetchSlabs();
  }, []);

  async function fetchSlabs() {
    setLoading(true);
    try {
      const res = await fetch("/api/tax-slabs");
      const data = await res.json();
      setSlabs(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load tax slabs.");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", percentage: "", minAmount: "", maxAmount: "", isActive: true });
    setError("");
    setShowModal(true);
  }

  function openEdit(slab: TaxSlab) {
    setEditingId(slab.id);
    setForm({
      name: slab.name,
      percentage: String(slab.percentage),
      minAmount: slab.minAmount != null ? String(slab.minAmount) : "",
      maxAmount: slab.maxAmount != null ? String(slab.maxAmount) : "",
      isActive: slab.isActive,
    });
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      percentage: parseFloat(form.percentage),
      isActive: form.isActive,
    };

    if (form.minAmount !== "") payload.minAmount = parseFloat(form.minAmount);
    if (form.maxAmount !== "") payload.maxAmount = parseFloat(form.maxAmount);

    try {
      const url = editingId ? "/api/tax-slabs" : "/api/tax-slabs";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...payload, id: editingId } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      closeModal();
      fetchSlabs();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/tax-slabs?id=${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed.");
        setDeleteId(null);
        return;
      }
      setDeleteId(null);
      fetchSlabs();
    } catch {
      setError("Network error. Please try again.");
      setDeleteId(null);
    }
  }

  async function toggleActive(slab: TaxSlab) {
    try {
      const res = await fetch("/api/tax-slabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slab.id, isActive: !slab.isActive }),
      });
      if (res.ok) fetchSlabs();
    } catch {
      /* silent fail */
    }
  }

  function sortedSlabs() {
    return [...slabs].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = a.percentage - b.percentage;
      return sortAsc ? cmp : -cmp;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 text-accent-highlight" />
      : <ChevronDown className="w-3 h-3 text-accent-highlight" />;
  }

  const hasSlabs = slabs.length > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-serif font-semibold mb-1"
          style={{ color: "#1F2E22", fontFamily: "Playfair Display, serif" }}
        >
          Tax Slabs
        </h1>
        <p className="text-sm" style={{ color: "#7C735C", fontFamily: "Inter, sans-serif" }}>
          Manage tax rates automatically applied at checkout and POS.
        </p>
      </div>

      {/* Info Banner */}
      <div
        className="rounded-lg p-4 mb-6 border"
        style={{
          background: "#F4F1E8",
          borderColor: "#D3CAB2",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: "#1F2E22" }}>
          How tax auto-application works
        </p>
        <p className="text-sm" style={{ color: "#4F4A39" }}>
          Tax slabs are evaluated per-item at checkout and in POS. Each slab defines a price range
          (min / max amount). Items falling within a range automatically receive that slab&apos;s
          rate. Example: Items priced ₹0–₹999 → 5% GST, Items ₹1,000 and above → 12% GST.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "#7C735C", fontFamily: "Inter, sans-serif" }}>
          {hasSlabs ? `${slabs.length} slab${slabs.length !== 1 ? "s" : ""} configured` : "No slabs configured"}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
          style={{
            background: "#C8A96E",
            color: "#1F2E22",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <Plus className="w-4 h-4" />
          Add Tax Slab
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded text-sm"
          style={{ background: "#F4F1E8", border: "1px solid #D3CAB2", color: "#1F2E22" }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#C8A96E", borderTopColor: "transparent" }}
          />
        </div>
      ) : !hasSlabs ? (
        <div
          className="rounded-lg py-16 text-center border"
          style={{ borderColor: "#D3CAB2", background: "#F4F1E8" }}
        >
          <p className="text-sm mb-1" style={{ color: "#4F4A39", fontFamily: "Inter, sans-serif" }}>
            No tax slabs yet
          </p>
          <p className="text-xs mb-4" style={{ color: "#A89F86", fontFamily: "Inter, sans-serif" }}>
            Add your first slab to start applying tax automatically.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
            style={{ background: "#C8A96E", color: "#1F2E22", fontFamily: "Inter, sans-serif" }}
          >
            <Plus className="w-4 h-4" />
            Add Tax Slab
          </button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#D3CAB2" }}>
          <table className="w-full text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
            <thead>
              <tr style={{ background: "#F4F1E8", borderBottom: "1px solid #D3CAB2" }}>
                <th
                  className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wide cursor-pointer select-none"
                  style={{ color: "#7C735C" }}
                  onClick={() => toggleSort("name")}
                >
                  <span className="flex items-center gap-1">
                    Name <SortIcon k="name" />
                  </span>
                </th>
                <th
                  className="text-right px-5 py-3 font-medium text-xs uppercase tracking-wide cursor-pointer select-none"
                  style={{ color: "#7C735C" }}
                  onClick={() => toggleSort("percentage")}
                >
                  <span className="flex items-center justify-end gap-1">
                    Rate <SortIcon k="percentage" />
                  </span>
                </th>
                <th
                  className="text-right px-5 py-3 font-medium text-xs uppercase tracking-wide"
                  style={{ color: "#7C735C" }}
                >
                  Min Amount
                </th>
                <th
                  className="text-right px-5 py-3 font-medium text-xs uppercase tracking-wide"
                  style={{ color: "#7C735C" }}
                >
                  Max Amount
                </th>
                <th
                  className="text-center px-5 py-3 font-medium text-xs uppercase tracking-wide"
                  style={{ color: "#7C735C" }}
                >
                  Active
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {sortedSlabs().map((slab) => (
                <tr
                  key={slab.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid #E7E1D0" }}
                >
                  <td className="px-5 py-4 font-medium" style={{ color: "#1F2E22" }}>
                    {slab.name}
                  </td>
                  <td className="px-5 py-4 text-right font-medium" style={{ color: "#C8A96E" }}>
                    {slab.percentage}%
                  </td>
                  <td className="px-5 py-4 text-right text-sm" style={{ color: "#4F4A39" }}>
                    {slab.minAmount != null ? `₹${slab.minAmount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-5 py-4 text-right text-sm" style={{ color: "#4F4A39" }}>
                    {slab.maxAmount != null ? `₹${slab.maxAmount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {/* Flex-based toggle: knob sits at start/end via justify,
                        so it can never overflow the track regardless of size. */}
                    <button
                      onClick={() => toggleActive(slab)}
                      className={`inline-flex items-center w-10 h-5 rounded-full px-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        slab.isActive ? "justify-end" : "justify-start"
                      }`}
                      style={{ background: slab.isActive ? "#C8A96E" : "#D3CAB2" }}
                      aria-label={slab.isActive ? "Deactivate" : "Activate"}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow" />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(slab)}
                        className="p-1.5 rounded transition-colors hover:bg-white/10"
                        style={{ color: "#7C735C" }}
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(slab.id)}
                        className="p-1.5 rounded transition-colors hover:bg-red-50"
                        style={{ color: "#A89F86" }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div
            className="relative w-full max-w-md rounded-xl shadow-2xl p-6"
            style={{ background: "#FFFFFF" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xl font-semibold"
                style={{ color: "#1F2E22", fontFamily: "Playfair Display, serif" }}
              >
                {editingId ? "Edit Tax Slab" : "Add Tax Slab"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded transition-colors"
                style={{ color: "#A89F86" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: "Inter, sans-serif" }}>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: "#7C735C" }}>
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Standard GST"
                  className="w-full px-3 py-2 rounded border text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: "#D3CAB2",
                    background: "#F4F1E8",
                    color: "#1F2E22",
                    fontFamily: "Inter, sans-serif",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: "#7C735C" }}>
                  Rate (%) *
                </label>
                <input
                  type="text" inputMode="decimal"
                  required
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.percentage}
                  onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))}
                  placeholder="e.g. 18"
                  className="w-full px-3 py-2 rounded border text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: "#D3CAB2",
                    background: "#F4F1E8",
                    color: "#1F2E22",
                    fontFamily: "Inter, sans-serif",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: "#7C735C" }}>
                    Min Amount (₹)
                  </label>
                  <input
                    type="text" inputMode="decimal"
                    min="0"
                    step="1"
                    value={form.minAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
                    placeholder="e.g. 0"
                    className="w-full px-3 py-2 rounded border text-sm transition-colors focus:outline-none focus:ring-2"
                    style={{
                      borderColor: "#D3CAB2",
                      background: "#F4F1E8",
                      color: "#1F2E22",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: "#7C735C" }}>
                    Max Amount (₹)
                  </label>
                  <input
                    type="text" inputMode="decimal"
                    min="0"
                    step="1"
                    value={form.maxAmount}
                    onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))}
                    placeholder="e.g. 999"
                    className="w-full px-3 py-2 rounded border text-sm transition-colors focus:outline-none focus:ring-2"
                    style={{
                      borderColor: "#D3CAB2",
                      background: "#F4F1E8",
                      color: "#1F2E22",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`inline-flex items-center w-10 h-5 rounded-full px-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    form.isActive ? "justify-end" : "justify-start"
                  }`}
                  style={{ background: form.isActive ? "#C8A96E" : "#D3CAB2" }}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </button>
                <span className="text-sm" style={{ color: "#4F4A39" }}>
                  {form.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 rounded text-sm font-medium border transition-colors"
                  style={{
                    borderColor: "#D3CAB2",
                    color: "#4F4A39",
                    background: "#FFFFFF",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: "#C8A96E",
                    color: "#1F2E22",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {saving ? "Saving…" : editingId ? "Update Slab" : "Create Slab"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div
            className="relative w-full max-w-sm rounded-xl shadow-2xl p-6"
            style={{ background: "#FFFFFF" }}
          >
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: "#1F2E22", fontFamily: "Playfair Display, serif" }}
            >
              Delete Tax Slab?
            </h3>
            <p className="text-sm mb-5" style={{ color: "#4F4A39", fontFamily: "Inter, sans-serif" }}>
              This will deactivate the slab. It won&apos;t affect existing orders. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded text-sm font-medium border transition-colors"
                style={{
                  borderColor: "#D3CAB2",
                  color: "#4F4A39",
                  background: "#FFFFFF",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  background: "#1F2E22",
                  color: "#FFFFFF",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
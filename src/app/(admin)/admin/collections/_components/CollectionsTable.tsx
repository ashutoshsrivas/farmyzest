"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Lock, Check } from "lucide-react";

const TYPE_BADGE: Record<string, string> = {
  SUMMER: "bg-orange-100 text-orange-700",
  WINTER: "bg-blue-100 text-blue-700",
  SEASONAL: "bg-purple-100 text-purple-700",
  CUSTOM: "bg-nate-grey-100 text-nate-grey-700",
};

interface Membership {
  categoryId: string;
  exclusive: boolean;
}
interface Collection {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  rankOnHome: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  categories: Membership[];
  _count: { products: number; categories: number };
}
interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

const EMPTY = {
  name: "",
  slug: "",
  type: "CUSTOM",
  isActive: true,
  rankOnHome: false,
  showInHeader: false,
  showInFooter: false,
};

export function CollectionsTable({
  collections,
  categories,
}: {
  collections: Collection[];
  categories: Category[];
}) {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [form, setForm] = useState(EMPTY);
  // Selected category ids + which of them are exclusive.
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [exclusiveIds, setExclusiveIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const allIds = categories.map((c) => c.id);
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY);
    setMemberIds(new Set(allIds)); // default: all categories
    setExclusiveIds(new Set());
    setMessage(null);
    setShowModal(true);
  }

  function openEdit(c: Collection) {
    setEditTarget(c);
    setForm({
      name: c.name,
      slug: c.slug,
      type: c.type,
      isActive: c.isActive,
      rankOnHome: c.rankOnHome,
      showInHeader: c.showInHeader,
      showInFooter: c.showInFooter,
    });
    setMemberIds(new Set(c.categories.map((m) => m.categoryId)));
    setExclusiveIds(new Set(c.categories.filter((m) => m.exclusive).map((m) => m.categoryId)));
    setMessage(null);
    setShowModal(true);
  }

  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setForm((prev) => ({ ...prev, name, slug }));
  }

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setExclusiveIds((ex) => {
          const e = new Set(ex);
          e.delete(id);
          return e;
        });
      } else next.add(id);
      return next;
    });
  }

  function toggleExclusive(id: string) {
    setExclusiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        setMemberIds((m) => new Set(m).add(id)); // exclusive implies member
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...(editTarget ? { id: editTarget.id } : {}),
        ...form,
        categoryIds: [...memberIds],
        exclusiveCategoryIds: [...exclusiveIds],
      };
      const res = await fetch("/api/collections", {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage({ type: "success", text: editTarget ? "Collection updated." : "Collection created." });
        setTimeout(() => window.location.reload(), 700);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save collection." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Collection) {
    if (!confirm(`Delete collection "${c.name}"?`)) return;
    try {
      await fetch(`/api/collections?id=${c.id}`, { method: "DELETE" });
      window.location.reload();
    } catch {
      alert("Failed to delete collection.");
    }
  }

  function placementLabel(c: Collection) {
    const bits = [
      c.rankOnHome && "Home",
      c.showInHeader && "Header",
      c.showInFooter && "Footer",
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : "—";
  }

  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
          <p className="text-sm text-nate-grey-500">{collections.length} collections</p>
          <button
            onClick={openAdd}
            className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Collection
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nate-grey-100 bg-nate-grey-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Type</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Active</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Shown</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Categories</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {collections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-nate-grey-500">
                  No collections yet. Create your first one.
                </td>
              </tr>
            ) : (
              collections.map((c) => {
                const exCount = c.categories.filter((m) => m.exclusive).length;
                return (
                  <tr key={c.id} className="hover:bg-nate-grey-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-nate-grey-800">{c.name}</p>
                      <p className="text-xs text-nate-grey-400 font-mono">{c.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_BADGE[c.type] || "bg-nate-grey-100 text-nate-grey-600"}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-nate-grey-100 text-nate-grey-500"}`}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-nate-grey-600 text-xs">{placementLabel(c)}</td>
                    <td className="px-6 py-4 text-right text-nate-grey-600">
                      {c._count.categories}
                      {exCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-amber-700">
                          <Lock className="w-3 h-3" />
                          {exCount}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="text-nate-grey-500 hover:text-accent transition-colors p-1" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c)} className="text-nate-grey-400 hover:text-red-600 transition-colors p-1" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100 shrink-0">
              <h2 className="text-lg font-serif text-nate-grey-800">
                {editTarget ? "Edit Collection" : "New Collection"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-nate-grey-400 hover:text-nate-grey-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {message && (
                <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                    placeholder="e.g. Special Collection"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400 font-mono"
                    placeholder="special-collection"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                >
                  <option value="CUSTOM">Custom</option>
                  <option value="SUMMER">Summer</option>
                  <option value="WINTER">Winter</option>
                  <option value="SEASONAL">Seasonal</option>
                </select>
              </div>

              {/* Placement */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-2">Where shown</label>
                <div className="flex flex-wrap gap-4">
                  {([
                    ["isActive", "Active"],
                    ["rankOnHome", "Homepage"],
                    ["showInHeader", "Header menu"],
                    ["showInFooter", "Footer"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-nate-grey-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-nate-grey-300 accent-black"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Categories + exclusivity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-nate-grey-700">
                    Categories in this collection
                  </label>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setMemberIds(new Set(allIds))} className="text-accent hover:underline">
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberIds(new Set());
                        setExclusiveIds(new Set());
                      }}
                      className="text-nate-grey-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-nate-grey-400 mb-2">
                  Tick a category to include it. Mark <span className="text-amber-700 font-medium">Exclusive</span> to
                  show that category&apos;s products <em>only</em> under this collection (removed from everywhere else,
                  and from other collections).
                </p>
                <div className="border border-nate-grey-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-nate-grey-100">
                  {roots.map((root) => (
                    <div key={root.id}>
                      <Row
                        cat={root}
                        depth={0}
                        member={memberIds.has(root.id)}
                        exclusive={exclusiveIds.has(root.id)}
                        onToggleMember={() => toggleMember(root.id)}
                        onToggleExclusive={() => toggleExclusive(root.id)}
                      />
                      {childrenOf(root.id).map((child) => (
                        <Row
                          key={child.id}
                          cat={child}
                          depth={1}
                          member={memberIds.has(child.id)}
                          exclusive={exclusiveIds.has(child.id)}
                          onToggleMember={() => toggleMember(child.id)}
                          onToggleExclusive={() => toggleExclusive(child.id)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-nate-grey-400 mt-1">
                  {memberIds.size} selected · {exclusiveIds.size} exclusive
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50 transition-colors">
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

function Row({
  cat,
  depth,
  member,
  exclusive,
  onToggleMember,
  onToggleExclusive,
}: {
  cat: { name: string };
  depth: number;
  member: boolean;
  exclusive: boolean;
  onToggleMember: () => void;
  onToggleExclusive: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-nate-grey-50" style={{ paddingLeft: 12 + depth * 18 }}>
      <button type="button" onClick={onToggleMember} className="flex items-center gap-2 text-sm text-left flex-1">
        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${member ? "bg-nate-grey-900 border-nate-grey-900 text-white" : "border-nate-grey-300"}`}>
          {member && <Check className="w-3 h-3" />}
        </span>
        {depth > 0 && <span className="text-nate-grey-300">›</span>}
        <span className={member ? "text-nate-grey-800" : "text-nate-grey-500"}>{cat.name}</span>
      </button>
      <button
        type="button"
        onClick={onToggleExclusive}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
          exclusive ? "bg-amber-100 text-amber-700" : "bg-nate-grey-100 text-nate-grey-400 hover:bg-nate-grey-200"
        }`}
        title="Exclusive to this collection"
      >
        <Lock className="w-3 h-3" />
        Exclusive
      </button>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, ChevronRight, ChevronDown, ImagePlus, Loader2, AlertTriangle } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  maxDiscountPct: number | null;
  maxOnlineDiscountPct: number | null;
  maxPosDiscountPct: number | null;
  discountPct: number | null;
  posDiscountPct: number | null;
  excludeFromLastPiece: boolean;
  _count: { products: number; taggedProducts: number };
  children?: Category[];
}

export function CategoriesTree({ categories }: { categories: Category[] }) {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: "",
    slug: "",
    parentId: "",
    imageUrl: "",
    sortOrder: 0,
    maxDiscountPct: "" as string,
    maxOnlineDiscountPct: "" as string,
    maxPosDiscountPct: "" as string,
    discountPct: "" as string,
    posDiscountPct: "" as string,
    excludeFromLastPiece: false,
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete flow (with product reassignment).
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteMode, setDeleteMode] = useState<"move" | "uncategorised">("uncategorised");
  const [deleteTargetId, setDeleteTargetId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // Build tree from flat list
  const rootCategories = categories.filter((c) => !c.parentId);

  function buildTree(cats: Category[]): Category[] {
    return cats.map((c) => ({
      ...c,
      children: buildTree(categories.filter((x) => x.parentId === c.id)),
    }));
  }

  const tree = buildTree(rootCategories);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAdd(parentId?: string) {
    setEditTarget(null);
    setForm({ name: "", slug: "", parentId: parentId || "", imageUrl: "", sortOrder: 0, maxDiscountPct: "", maxOnlineDiscountPct: "", maxPosDiscountPct: "", discountPct: "", posDiscountPct: "", excludeFromLastPiece: false });
    setImagePreview("");
    setMessage(null);
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditTarget(c);
    setForm({
      name: c.name,
      slug: c.slug,
      parentId: c.parentId || "",
      imageUrl: c.imageUrl || "",
      sortOrder: c.sortOrder,
      maxDiscountPct: c.maxDiscountPct != null ? String(c.maxDiscountPct) : "",
      maxOnlineDiscountPct: c.maxOnlineDiscountPct != null ? String(c.maxOnlineDiscountPct) : "",
      maxPosDiscountPct: c.maxPosDiscountPct != null ? String(c.maxPosDiscountPct) : "",
      discountPct: c.discountPct != null ? String(c.discountPct) : "",
      posDiscountPct: c.posDiscountPct != null ? String(c.posDiscountPct) : "",
      excludeFromLastPiece: !!c.excludeFromLastPiece,
    });
    setImagePreview(c.imageUrl || "");
    setMessage(null);
    setShowModal(true);
  }

  // All ids in the subtree rooted at `id` (the category + every descendant) —
  // these can't be a move target when deleting `id`.
  function descendantIds(id: string): Set<string> {
    const out = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of categories) {
        if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
          out.add(c.id);
          added = true;
        }
      }
    }
    return out;
  }

  function openDelete(c: Category) {
    setDeleteTarget(c);
    setDeleteMode("uncategorised");
    setDeleteTargetId("");
    setDeleteMsg(null);
  }

  async function performDelete() {
    if (!deleteTarget) return;
    const hasProducts =
      deleteTarget._count.products > 0 || deleteTarget._count.taggedProducts > 0;
    if (hasProducts && deleteMode === "move" && !deleteTargetId) {
      setDeleteMsg("Choose a category to move the products into.");
      return;
    }
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const body = hasProducts
        ? deleteMode === "move"
          ? { mode: "move", targetId: deleteTargetId }
          : { mode: "uncategorised" }
        : {};
      const res = await fetch(`/api/categories/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteMsg(data.error || "Failed to delete category.");
        setDeleting(false);
      }
    } catch {
      setDeleteMsg("Network error. Please try again.");
      setDeleting(false);
    }
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

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const slug = form.slug || editTarget?.slug || "category";
    const key = `categories/${slug}-${Date.now()}.${ext}`;

    setUploading(true);
    try {
      // Get presigned URL
      const res = await fetch(
        `/api/upload/presign?key=${encodeURIComponent(key)}&type=${encodeURIComponent(file.type)}`
      );
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await res.json();

      // Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      setForm((prev) => ({ ...prev, imageUrl: publicUrl }));
      setImagePreview(publicUrl);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Image upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        sortOrder: form.sortOrder,
        imageUrl: form.imageUrl || null,
        maxDiscountPct: form.maxDiscountPct === "" ? null : Number(form.maxDiscountPct),
        maxOnlineDiscountPct: form.maxOnlineDiscountPct === "" ? null : Number(form.maxOnlineDiscountPct),
        maxPosDiscountPct: form.maxPosDiscountPct === "" ? null : Number(form.maxPosDiscountPct),
        discountPct: form.discountPct === "" ? null : Number(form.discountPct),
        posDiscountPct: form.posDiscountPct === "" ? null : Number(form.posDiscountPct),
        excludeFromLastPiece: form.excludeFromLastPiece,
      };
      if (form.parentId) body.parentId = form.parentId;
      if (editTarget) body.id = editTarget.id;

      const res = await fetch("/api/categories", {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessage({ type: "success", text: editTarget ? "Category updated." : "Category created." });
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

  function renderCategory(c: Category, depth = 0) {
    const hasChildren = c.children && c.children.length > 0;
    const isExpanded = expanded.has(c.id);

    return (
      <div key={c.id}>
        <div
          className="flex items-center justify-between px-6 py-3 border-b border-nate-grey-50 hover:bg-nate-grey-50 transition-colors"
          style={{ paddingLeft: `${1.5 + depth * 1.5}rem` }}
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(c.id)}
                className="text-nate-grey-400 hover:text-nate-grey-700 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {/* Category image thumbnail */}
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-nate-grey-100 flex-shrink-0 border border-nate-grey-200">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-nate-grey-300">
                  <ImagePlus className="w-4 h-4" />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-nate-grey-800">{c.name}</p>
              <p className="text-xs text-nate-grey-400 font-mono">{c.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-xs text-nate-grey-500">{c._count.products} products</span>
            {c.imageUrl ? (
              <span className="text-xs text-green-600 font-medium">Has image</span>
            ) : (
              <span className="text-xs text-amber-500">No image</span>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAdd(c.id)}
                className="text-nate-grey-400 hover:text-accent transition-colors p-1"
                title="Add subcategory"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openEdit(c)}
                className="text-nate-grey-400 hover:text-accent transition-colors p-1"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openDelete(c)}
                className="text-nate-grey-400 hover:text-red-600 transition-colors p-1"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && c.children!.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
          <p className="text-sm text-nate-grey-500">{categories.length} categories</p>
          <button
            onClick={() => openAdd()}
            className="bg-nate-grey-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        <div>
          {tree.length === 0 ? (
            <div className="px-6 py-12 text-center text-nate-grey-500 text-sm">
              No categories yet. Create your first one.
            </div>
          ) : (
            tree.map((c) => renderCategory(c))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100 sticky top-0 bg-white">
              <h2 className="text-lg font-serif text-nate-grey-800">
                {editTarget ? "Edit Category" : "New Category"}
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
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder="e.g. Tops"
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
                  placeholder="tops"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                  Parent Category
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                >
                  <option value="">— None (top-level) —</option>
                  {categories
                    .filter((c) => !editTarget || c.id !== editTarget.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-2">
                  Category Image
                </label>
                <div className="space-y-3">
                  {/* Preview */}
                  {imagePreview && (
                    <div className="relative w-full h-36 rounded-lg overflow-hidden bg-nate-grey-100 border border-nate-grey-200">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview("");
                          setForm((prev) => ({ ...prev, imageUrl: "" }));
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        title="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-nate-grey-200 rounded-lg text-sm text-nate-grey-500 hover:border-nate-grey-400 hover:text-nate-grey-700 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-4 h-4" />
                        {imagePreview ? "Replace image" : "Upload image"}
                      </>
                    )}
                  </button>

                  {/* Or paste URL */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-nate-grey-400 pointer-events-none">
                      URL
                    </span>
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, imageUrl: e.target.value }));
                        setImagePreview(e.target.value);
                      }}
                      className="w-full border border-nate-grey-200 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                      placeholder="https://… or upload above"
                    />
                  </div>
                  <p className="text-xs text-nate-grey-400">
                    Recommended: 800×600px, JPG or WebP. Used in "Shop by Department" on homepage.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Sort Order</label>
                <input
                  type="text" inputMode="decimal"
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                  Max discount %
                </label>
                <input
                  type="text" inputMode="decimal"
                  min={0}
                  max={100}
                  value={form.maxDiscountPct}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxDiscountPct: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder="No cap (e.g. 15 for accessories)"
                />
                <p className="text-xs text-nate-grey-400 mt-1">
                  Caps any discount on products in this category (both channels). Leave blank for no cap.
                </p>
              </div>

              {/* Channel-specific caps — tighten the general cap above per channel. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                    Max online discount %
                  </label>
                  <input
                    type="text" inputMode="decimal"
                    min={0}
                    max={100}
                    value={form.maxOnlineDiscountPct}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxOnlineDiscountPct: e.target.value }))}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                    placeholder="Online-only cap"
                  />
                  <p className="text-xs text-nate-grey-400 mt-1">
                    Extra cap online, on top of Max discount. Leave blank for none.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                    Max POS discount %
                  </label>
                  <input
                    type="text" inputMode="decimal"
                    min={0}
                    max={100}
                    value={form.maxPosDiscountPct}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxPosDiscountPct: e.target.value }))}
                    className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                    placeholder="POS-only cap"
                  />
                  <p className="text-xs text-nate-grey-400 mt-1">
                    Extra cap at the counter, on top of Max discount. Leave blank for none.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                  Online discount %
                </label>
                <input
                  type="text" inputMode="decimal"
                  min={0}
                  max={100}
                  value={form.discountPct}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountPct: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder="e.g. 10 — 10% off every item online"
                />
                <p className="text-xs text-nate-grey-400 mt-1">
                  Flat discount applied to <strong>every</strong> product in this category on the
                  <strong> storefront</strong> — shown as a discounted price and charged at online
                  checkout. Leave blank for none.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                  POS discount %
                </label>
                <input
                  type="text" inputMode="decimal"
                  min={0}
                  max={100}
                  value={form.posDiscountPct}
                  onChange={(e) => setForm((prev) => ({ ...prev, posDiscountPct: e.target.value }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                  placeholder="e.g. 5 — 5% off every item at the counter"
                />
                <p className="text-xs text-nate-grey-400 mt-1">
                  Flat discount applied to <strong>every</strong> product in this category at the
                  <strong> POS counter</strong> — independent of the online discount. Leave blank
                  for none.
                </p>
              </div>
              </div>

              <div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.excludeFromLastPiece}
                    onChange={(e) => setForm((prev) => ({ ...prev, excludeFromLastPiece: e.target.checked }))}
                    className="h-4 w-4 mt-0.5 accent-black cursor-pointer"
                  />
                  <span>
                    <span className="text-sm font-medium text-nate-grey-700">
                      Exclude from last-piece Special Prices
                    </span>
                    <span className="block text-xs text-nate-grey-400 mt-0.5">
                      Products in this category won&apos;t auto-move to Special Prices (or get the
                      10% markdown) when their stock drops to one.
                    </span>
                  </span>
                </label>
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
                  disabled={saving || uploading}
                  className="bg-nate-grey-800 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : editTarget ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete + reassign modal */}
      {deleteTarget && (() => {
        const descSet = descendantIds(deleteTarget.id);
        const targetOptions = categories.filter((c) => !descSet.has(c.id));
        const childCount = categories.filter((c) => c.parentId === deleteTarget.id).length;
        const primary = deleteTarget._count.products;
        const tagged = deleteTarget._count.taggedProducts;
        const hasProducts = primary > 0 || tagged > 0;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-lg font-serif text-nate-grey-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Delete “{deleteTarget.name}”
                </h2>
                <button
                  onClick={() => !deleting && setDeleteTarget(null)}
                  className="text-nate-grey-400 hover:text-nate-grey-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {deleteMsg && (
                  <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                    {deleteMsg}
                  </div>
                )}

                {hasProducts ? (
                  <>
                    <p className="text-sm text-nate-grey-600">
                      This category has{" "}
                      <strong className="text-nate-grey-800">
                        {primary > 0 && `${primary} product${primary === 1 ? "" : "s"}`}
                        {primary > 0 && tagged > 0 && " "}
                        {tagged > 0 && `${tagged} tagged`}
                      </strong>
                      . Choose where they should go before deleting.
                    </p>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-nate-grey-200 cursor-pointer hover:bg-nate-grey-50">
                      <input
                        type="radio"
                        name="delMode"
                        checked={deleteMode === "move"}
                        onChange={() => setDeleteMode("move")}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-nate-grey-800">Move to another category</p>
                        <select
                          value={deleteTargetId}
                          onChange={(e) => {
                            setDeleteTargetId(e.target.value);
                            setDeleteMode("move");
                          }}
                          className="mt-2 w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400 disabled:opacity-50"
                          disabled={deleteMode !== "move"}
                        >
                          <option value="">— Select a category —</option>
                          {targetOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.parentId ? "— " : ""}
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-nate-grey-200 cursor-pointer hover:bg-nate-grey-50">
                      <input
                        type="radio"
                        name="delMode"
                        checked={deleteMode === "uncategorised"}
                        onChange={() => setDeleteMode("uncategorised")}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-nate-grey-800">Move to “Uncategorised”</p>
                        <p className="text-xs text-nate-grey-500 mt-0.5">
                          Products are parked in a hidden Uncategorised bucket (created if needed).
                        </p>
                      </div>
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-nate-grey-600">
                    This category has no products. It will be permanently deleted.
                  </p>
                )}

                {childCount > 0 && (
                  <p className="text-xs text-nate-grey-500 bg-nate-grey-50 rounded-lg px-3 py-2">
                    Its {childCount} subcategor{childCount === 1 ? "y" : "ies"} will move up one level
                    (kept, not deleted).
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={performDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {deleting ? "Deleting…" : "Delete category"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, ImagePlus, Loader2, AlertTriangle } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  maxDiscountPct: number | null;
  maxOnlineDiscountPct: number | null;
  maxPosDiscountPct: number | null;
  discountPct: number | null;
  posDiscountPct: number | null;
  excludeFromLastPiece: boolean;
  _count: { products: number };
}

const emptyForm = {
  name: "",
  slug: "",
  imageUrl: "",
  sortOrder: 0,
  maxDiscountPct: "" as string,
  maxOnlineDiscountPct: "" as string,
  maxPosDiscountPct: "" as string,
  discountPct: "" as string,
  posDiscountPct: "" as string,
  excludeFromLastPiece: false,
};

export function BrandsManager({ brands }: { brands: Brand[] }) {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Brand | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  function openAdd() {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setImagePreview("");
    setMessage(null);
    setShowModal(true);
  }

  function openEdit(b: Brand) {
    setEditTarget(b);
    setForm({
      name: b.name,
      slug: b.slug,
      imageUrl: b.imageUrl || "",
      sortOrder: b.sortOrder,
      maxDiscountPct: b.maxDiscountPct != null ? String(b.maxDiscountPct) : "",
      maxOnlineDiscountPct: b.maxOnlineDiscountPct != null ? String(b.maxOnlineDiscountPct) : "",
      maxPosDiscountPct: b.maxPosDiscountPct != null ? String(b.maxPosDiscountPct) : "",
      discountPct: b.discountPct != null ? String(b.discountPct) : "",
      posDiscountPct: b.posDiscountPct != null ? String(b.posDiscountPct) : "",
      excludeFromLastPiece: !!b.excludeFromLastPiece,
    });
    setImagePreview(b.imageUrl || "");
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

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const slug = form.slug || editTarget?.slug || "brand";
    const key = `brands/${slug}-${Date.now()}.${ext}`;
    setUploading(true);
    try {
      const res = await fetch(`/api/upload/presign?key=${encodeURIComponent(key)}&type=${encodeURIComponent(file.type)}`);
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await res.json();
      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
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
      const num = (v: string) => (v === "" ? null : Number(v));
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        sortOrder: form.sortOrder,
        imageUrl: form.imageUrl || null,
        maxDiscountPct: num(form.maxDiscountPct),
        maxOnlineDiscountPct: num(form.maxOnlineDiscountPct),
        maxPosDiscountPct: num(form.maxPosDiscountPct),
        discountPct: num(form.discountPct),
        posDiscountPct: num(form.posDiscountPct),
        excludeFromLastPiece: form.excludeFromLastPiece,
      };
      if (editTarget) body.id = editTarget.id;
      const res = await fetch("/api/admin/brands", {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessage({ type: "success", text: editTarget ? "Brand updated." : "Brand created." });
        setTimeout(() => window.location.reload(), 700);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function performDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch(`/api/admin/brands?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteMsg(data.error || "Failed to delete brand.");
        setDeleting(false);
      }
    } catch {
      setDeleteMsg("Network error. Please try again.");
      setDeleting(false);
    }
  }

  const numField = (
    label: string,
    key: keyof typeof form,
    placeholder: string,
    hint: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-nate-grey-700 mb-1">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={form[key] as string}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        placeholder={placeholder}
      />
      <p className="text-xs text-nate-grey-400 mt-1">{hint}</p>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
          <p className="text-sm text-nate-grey-500">{brands.length} brands</p>
          <button
            onClick={openAdd}
            className="bg-nate-grey-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Brand
          </button>
        </div>

        {brands.length === 0 ? (
          <div className="px-6 py-12 text-center text-nate-grey-500 text-sm">
            No brands yet. Create your first one.
          </div>
        ) : (
          brands.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between px-6 py-3 border-b border-nate-grey-50 hover:bg-nate-grey-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-nate-grey-100 flex-shrink-0 border border-nate-grey-200">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-nate-grey-300">
                      <ImagePlus className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-nate-grey-800">{b.name}</p>
                  <p className="text-xs text-nate-grey-400 font-mono">{b.slug}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-xs text-nate-grey-500">{b._count.products} products</span>
                {b.discountPct || b.posDiscountPct ? (
                  <span className="text-xs text-green-600 font-medium">
                    {b.discountPct ? `${b.discountPct}% online` : ""}
                    {b.discountPct && b.posDiscountPct ? " · " : ""}
                    {b.posDiscountPct ? `${b.posDiscountPct}% POS` : ""}
                  </span>
                ) : null}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="text-nate-grey-400 hover:text-accent transition-colors p-1"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(b); setDeleteMsg(null); }}
                    className="text-nate-grey-400 hover:text-red-600 transition-colors p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100 sticky top-0 bg-white">
              <h2 className="text-lg font-serif text-nate-grey-800">
                {editTarget ? "Edit Brand" : "New Brand"}
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
                  placeholder="e.g. Nike"
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
                  placeholder="nike"
                />
              </div>

              {/* Logo / image */}
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-2">Brand Logo / Image</label>
                <div className="space-y-3">
                  {imagePreview && (
                    <div className="relative w-full h-36 rounded-lg overflow-hidden bg-nate-grey-100 border border-nate-grey-200">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
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
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-nate-grey-200 rounded-lg text-sm text-nate-grey-500 hover:border-nate-grey-400 hover:text-nate-grey-700 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    ) : (
                      <><ImagePlus className="w-4 h-4" /> {imagePreview ? "Replace image" : "Upload image"}</>
                    )}
                  </button>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-nate-grey-400 pointer-events-none">URL</span>
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => { setForm((prev) => ({ ...prev, imageUrl: e.target.value })); setImagePreview(e.target.value); }}
                      className="w-full border border-nate-grey-200 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                      placeholder="https://… or upload above"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1">Sort Order</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                />
              </div>

              {numField("Max discount %", "maxDiscountPct", "No cap (e.g. 15)", "Caps any discount on products of this brand (both channels). Most restrictive of product / category / brand cap wins. Blank = no cap.")}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {numField("Max online discount %", "maxOnlineDiscountPct", "Online-only cap", "Extra cap online, on top of Max discount. Blank = none.")}
                {numField("Max POS discount %", "maxPosDiscountPct", "POS-only cap", "Extra cap at the counter, on top of Max discount. Blank = none.")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {numField("Online discount %", "discountPct", "e.g. 10", "Flat discount on every product of this brand on the storefront. Blank = none.")}
                {numField("POS discount %", "posDiscountPct", "e.g. 5", "Flat discount on every product of this brand at the counter. Blank = none.")}
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
                    <span className="text-sm font-medium text-nate-grey-700">Exclude from last-piece Special Prices</span>
                    <span className="block text-xs text-nate-grey-400 mt-0.5">
                      Products of this brand won&apos;t auto-move to Special Prices (or get the markdown) when stock drops to one.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800 transition-colors">
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

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-lg font-serif text-nate-grey-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Delete “{deleteTarget.name}”
              </h2>
              <button onClick={() => !deleting && setDeleteTarget(null)} className="text-nate-grey-400 hover:text-nate-grey-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {deleteMsg && (
                <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{deleteMsg}</div>
              )}
              {deleteTarget._count.products > 0 ? (
                <p className="text-sm text-nate-grey-600">
                  This brand has <strong className="text-nate-grey-800">{deleteTarget._count.products} product{deleteTarget._count.products === 1 ? "" : "s"}</strong>.
                  Reassign or clear their brand first — a brand in use can&apos;t be deleted.
                </p>
              ) : (
                <p className="text-sm text-nate-grey-600">This brand has no products. It will be permanently deleted.</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performDelete}
                  disabled={deleting || deleteTarget._count.products > 0}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? "Deleting…" : "Delete brand"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

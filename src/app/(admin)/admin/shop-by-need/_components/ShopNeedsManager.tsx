"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { uploadProductImage } from "@/lib/upload-image";

interface Need {
  id: string;
  title: string;
  body: string;
  href: string;
  imageUrl: string | null;
  enabled: boolean;
}

type Draft = Omit<Need, "id" | "enabled"> & { id?: string; enabled: boolean };

const EMPTY: Draft = { title: "", body: "", href: "/shop?category=", imageUrl: "", enabled: true };

const input =
  "w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export function ShopNeedsManager({ initial }: { initial: Need[] }) {
  const [needs, setNeeds] = useState<Need[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(type: "ok" | "error", text: string) {
    setMessage({ type, text });
    if (type === "ok") setTimeout(() => setMessage(null), 2500);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        ...(draft.id ? { id: draft.id } : {}),
        title: draft.title,
        body: draft.body,
        href: draft.href,
        imageUrl: draft.imageUrl ?? "",
        enabled: draft.enabled,
      };
      const res = await fetch("/api/admin/shop-needs", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the card.");
      const saved: Need = data.need;
      setNeeds((list) => (draft.id ? list.map((n) => (n.id === saved.id ? saved : n)) : [...list, saved]));
      setDraft(null);
      flash("ok", draft.id ? "Card updated." : "Card added.");
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Could not save the card.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(n: Need) {
    const res = await fetch("/api/admin/shop-needs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id, enabled: !n.enabled }),
    });
    if (res.ok) setNeeds((list) => list.map((x) => (x.id === n.id ? { ...x, enabled: !n.enabled } : x)));
    else flash("error", "Could not change visibility.");
  }

  async function remove(n: Need) {
    if (!window.confirm(`Delete "${n.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/shop-needs?id=${encodeURIComponent(n.id)}`, { method: "DELETE" });
    if (res.ok) {
      setNeeds((list) => list.filter((x) => x.id !== n.id));
      flash("ok", "Card deleted.");
    } else flash("error", "Could not delete the card.");
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= needs.length) return;
    const next = [...needs];
    [next[index], next[target]] = [next[target], next[index]];
    setNeeds(next);
    const res = await fetch("/api/admin/shop-needs/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((n) => n.id) }),
    });
    if (!res.ok) flash("error", "Could not save the new order.");
  }

  async function onFile(file: File | undefined) {
    if (!file || !draft) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(file, `shop-need-${draft.title || "card"}`);
      setDraft((d) => (d ? { ...d, imageUrl: url } : d));
    } catch {
      flash("error", "Upload failed. Check the S3 settings, or paste an image link instead.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <p
          role="status"
          className={`rounded-lg px-4 py-2.5 text-sm ${message.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}
        >
          {message.text}
        </p>
      )}

      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
          <h2 className="text-base font-medium text-nate-grey-800">Cards ({needs.length})</h2>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="inline-flex items-center gap-1.5 bg-accent text-white text-sm px-3.5 py-2 rounded-lg hover:bg-accent-dark"
          >
            <Plus className="w-4 h-4" /> Add card
          </button>
        </div>
        {needs.length === 0 ? (
          <p className="px-6 py-6 text-sm text-nate-grey-400">No cards yet. The section is hidden on the homepage until you add one.</p>
        ) : (
          <ul>
            {needs.map((n, i) => (
              <li key={n.id} className={`flex items-center gap-4 px-6 py-3 border-b border-nate-grey-100 last:border-0 ${n.enabled ? "" : "opacity-50"}`}>
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${n.title} up`} className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === needs.length - 1} aria-label={`Move ${n.title} down`} className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-16 h-20 shrink-0 rounded-md bg-nate-grey-100 overflow-hidden">
                  {n.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.imageUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-nate-grey-800">{n.title}</p>
                  <p className="text-xs text-nate-grey-500 truncate">{n.body}</p>
                  <p className="text-xs text-nate-grey-400 font-mono truncate mt-0.5">{n.href}</p>
                </div>
                <button type="button" onClick={() => toggle(n)} aria-label={n.enabled ? `Hide ${n.title}` : `Show ${n.title}`} className="text-nate-grey-500 hover:text-nate-grey-900 p-1.5" title={n.enabled ? "Shown on site — click to hide" : "Hidden — click to show"}>
                  {n.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => setDraft({ ...n, imageUrl: n.imageUrl ?? "" })} aria-label={`Edit ${n.title}`} className="text-nate-grey-500 hover:text-nate-grey-900 p-1.5">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => remove(n)} aria-label={`Delete ${n.title}`} className="text-nate-grey-500 hover:text-red-600 p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {draft && (
        <form onSubmit={save} className="bg-white rounded-xl p-6 space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-nate-grey-800">{draft.id ? "Edit card" : "New card"}</h2>
            <button type="button" onClick={() => setDraft(null)} aria-label="Close form" className="text-nate-grey-400 hover:text-nate-grey-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div>
              <div className="relative aspect-[4/5] rounded-lg bg-nate-grey-100 overflow-hidden">
                {draft.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center gap-1 text-nate-grey-400 hover:text-nate-grey-700">
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs">Add photo</span>
                  </button>
                )}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-2 w-full text-xs text-nate-grey-600 hover:text-nate-grey-900 disabled:opacity-50">
                {uploading ? "Uploading…" : draft.imageUrl ? "Replace photo" : "Upload photo"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="need-title" className="block text-sm font-medium text-nate-grey-700 mb-1">Title</label>
                <input id="need-title" className={input} value={draft.title} maxLength={60} required onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Pest problem?" />
              </div>
              <div>
                <label htmlFor="need-body" className="block text-sm font-medium text-nate-grey-700 mb-1">Short line</label>
                <input id="need-body" className={input} value={draft.body} maxLength={120} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Insecticides, fungicides, organic sprays" />
              </div>
              <div>
                <label htmlFor="need-href" className="block text-sm font-medium text-nate-grey-700 mb-1">Link</label>
                <input id="need-href" className={`${input} font-mono`} value={draft.href} required onChange={(e) => setDraft({ ...draft, href: e.target.value })} placeholder="/shop?category=crop-protection" />
                <p className="text-xs text-nate-grey-400 mt-1">Tip: open the category on the site and copy the part of the address after the domain.</p>
              </div>
              <div>
                <label htmlFor="need-image" className="block text-sm font-medium text-nate-grey-700 mb-1">Photo link</label>
                <input id="need-image" className={`${input} font-mono`} value={draft.imageUrl ?? ""} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://… (filled in automatically when you upload)" />
              </div>
              <label className="flex items-center gap-2 text-sm text-nate-grey-700">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} className="h-4 w-4 accent-black" />
                Show on the homepage
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDraft(null)} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-800">
              Cancel
            </button>
            <button type="submit" disabled={saving || uploading} className="px-5 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark disabled:opacity-60">
              {saving ? "Saving…" : draft.id ? "Save card" : "Add card"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

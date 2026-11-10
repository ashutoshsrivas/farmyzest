"use client";

import { useRef, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  X,
  Star,
  ExternalLink,
  GripVertical,
} from "lucide-react";
import toast from "react-hot-toast";
import { uploadProductImage } from "@/lib/upload-image";

interface NavLink {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  enabled: boolean;
  newTab: boolean;
}
interface Cat {
  id: string;
  name: string;
  slug: string;
  showInMenu: boolean;
  menuHighlight: boolean;
  menuImageUrl: string | null;
}

export function NavigationManager({
  links: initialLinks,
  categories: initialCats,
}: {
  links: NavLink[];
  categories: Cat[];
}) {
  return (
    <div className="space-y-8">
      <NavLinksCard initial={initialLinks} />
      <ShopMenuCard initial={initialCats} />
    </div>
  );
}

/* ── Navbar links ─────────────────────────────────────────────────────────── */
function NavLinksCard({ initial }: { initial: NavLink[] }) {
  const [links, setLinks] = useState<NavLink[]>(initial);
  const [editing, setEditing] = useState<NavLink | null>(null);
  const [adding, setAdding] = useState(false);

  async function api(method: string, body?: unknown, qs = "") {
    const res = await fetch(`/api/admin/nav-links${qs}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Request failed");
    return data;
  }

  async function persistOrder(next: NavLink[]) {
    setLinks(next);
    try {
      await api("POST", { ids: next.map((l) => l.id) }, "/reorder");
    } catch {
      toast.error("Could not save order");
    }
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    persistOrder(next);
  }
  async function toggle(l: NavLink) {
    setLinks((p) => p.map((x) => (x.id === l.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await api("PUT", { id: l.id, enabled: !l.enabled });
    } catch {
      setLinks((p) => p.map((x) => (x.id === l.id ? { ...x, enabled: l.enabled } : x)));
    }
  }
  async function remove(l: NavLink) {
    if (!confirm(`Delete "${l.label}"?`)) return;
    setLinks((p) => p.filter((x) => x.id !== l.id));
    try {
      await api("DELETE", undefined, `?id=${l.id}`);
    } catch {
      toast.error("Could not delete");
    }
  }
  async function save(form: { id?: string; label: string; href: string; newTab: boolean }) {
    try {
      if (form.id) {
        const { link } = await api("PUT", form);
        setLinks((p) => p.map((x) => (x.id === link.id ? link : x)));
      } else {
        const { link } = await api("POST", form);
        setLinks((p) => [...p, link]);
      }
      setEditing(null);
      setAdding(false);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-nate-grey-100">
        <h2 className="text-base font-medium text-nate-grey-800">Navbar links</h2>
        <p className="text-xs text-nate-grey-400 mt-0.5">
          The simple links beside the “Shop” menu. Reorder, show/hide, or point them anywhere.
        </p>
      </div>
      <div className="divide-y divide-nate-grey-100">
        {links.map((l, idx) => (
          <div key={l.id} className="flex items-center gap-3 px-6 py-3">
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => move(idx, 1)} disabled={idx === links.length - 1} className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${l.enabled ? "text-nate-grey-800" : "text-nate-grey-400"}`}>
                {l.label}
                {l.newTab && <ExternalLink className="inline w-3 h-3 ml-1.5 text-nate-grey-400" />}
              </p>
              <p className="text-xs text-nate-grey-400 font-mono truncate">{l.href}</p>
            </div>
            <button onClick={() => toggle(l)} className="text-nate-grey-500 hover:text-nate-grey-900 p-1.5" title={l.enabled ? "Hide" : "Show"}>
              {l.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button onClick={() => setEditing(l)} className="text-nate-grey-500 hover:text-nate-grey-900 p-1.5" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => remove(l)} className="text-nate-grey-400 hover:text-red-600 p-1.5" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {links.length === 0 && <p className="px-6 py-6 text-sm text-nate-grey-400">No links yet.</p>}
      </div>
      <div className="px-6 py-4 border-t border-nate-grey-100">
        <button
          onClick={() => {
            setAdding(true);
            setEditing({ id: "", label: "", href: "", sortOrder: 0, enabled: true, newTab: false });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black"
        >
          <Plus className="w-4 h-4" /> Add link
        </button>
      </div>

      {editing && (
        <LinkModal
          link={editing}
          isNew={adding}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function LinkModal({
  link,
  isNew,
  onClose,
  onSave,
}: {
  link: NavLink;
  isNew: boolean;
  onClose: () => void;
  onSave: (f: { id?: string; label: string; href: string; newTab: boolean }) => void;
}) {
  const [label, setLabel] = useState(link.label);
  const [href, setHref] = useState(link.href);
  const [newTab, setNewTab] = useState(link.newTab);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
          <h3 className="text-lg font-serif text-nate-grey-800">{isNew ? "New link" : "Edit link"}</h3>
          <button onClick={onClose} className="text-nate-grey-400 hover:text-nate-grey-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Summer" className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">Link</label>
            <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/shop?collection=summer" className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent" />
            <p className="text-[11px] text-nate-grey-400 mt-1">e.g. /shop, /collections/special, /about, or a full https:// URL.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-nate-grey-700">
            <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} className="accent-black" />
            Open in a new tab
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-nate-grey-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-900">Cancel</button>
          <button
            onClick={() => {
              if (!label.trim() || !href.trim()) {
                toast.error("Label and link are required");
                return;
              }
              onSave({ id: link.id || undefined, label: label.trim(), href: href.trim(), newTab });
            }}
            className="px-5 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shop mega-menu categories ────────────────────────────────────────────── */
function ShopMenuCard({ initial }: { initial: Cat[] }) {
  const [cats, setCats] = useState<Cat[]>(initial);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Drag-to-reorder the mega-menu tiles. Native HTML5 DnD: as the dragged tile
  // enters another, we splice it into that slot so the grid re-flows (snapping
  // tiles into their cells); on drop we persist the order to Category.sortOrder
  // (the storefront mega-menu + shop filters read top-level cats by sortOrder).
  const dragIdxRef = useRef<number | null>(null);
  const preDrag = useRef<Cat[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function onDragStart(idx: number) {
    dragIdxRef.current = idx;
    preDrag.current = cats;
    setDraggingId(cats[idx]?.id ?? null);
  }
  function onDragEnter(idx: number) {
    const from = dragIdxRef.current;
    if (from === null || from === idx) return;
    setCats((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved!);
      return next;
    });
    dragIdxRef.current = idx;
  }
  async function saveOrder(order: Cat[], rollback: Cat[] | null) {
    try {
      const res = await fetch("/api/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: order.map((c) => c.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not save order");
      if (rollback) setCats(rollback);
    }
  }
  function onDragEnd() {
    setDraggingId(null);
    dragIdxRef.current = null;
    // Persist the freshest order (read via functional setState to dodge stale
    // closures from the live re-ordering above).
    setCats((cur) => {
      void saveOrder(cur, preDrag.current);
      return cur;
    });
  }

  async function patch(id: string, data: Partial<Cat>) {
    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
      toast.error("Could not save");
      return false;
    }
    return true;
  }

  async function setField(c: Cat, field: "showInMenu" | "menuHighlight", value: boolean) {
    setCats((p) => p.map((x) => (x.id === c.id ? { ...x, [field]: value } : x)));
    const ok = await patch(c.id, { [field]: value });
    if (!ok) setCats((p) => p.map((x) => (x.id === c.id ? { ...x, [field]: !value } : x)));
  }

  async function setImage(c: Cat, file: File | undefined) {
    if (!file) return;
    setUploadingId(c.id);
    try {
      const url = await uploadProductImage(file, "menu");
      setCats((p) => p.map((x) => (x.id === c.id ? { ...x, menuImageUrl: url } : x)));
      await patch(c.id, { menuImageUrl: url });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  async function clearImage(c: Cat) {
    setCats((p) => p.map((x) => (x.id === c.id ? { ...x, menuImageUrl: null } : x)));
    await patch(c.id, { menuImageUrl: null });
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-nate-grey-100">
        <h2 className="text-base font-medium text-nate-grey-800">Shop dropdown</h2>
        <p className="text-xs text-nate-grey-400 mt-0.5">
          A live preview of the “Shop” mega-menu. <span className="text-nate-grey-600">Drag the tiles</span> to
          reorder them, toggle which show, highlight key ones, and set an image tile.
        </p>
      </div>

      {cats.length === 0 ? (
        <p className="px-6 py-6 text-sm text-nate-grey-400">No top-level categories.</p>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-6"
          onDragOver={(e) => e.preventDefault()}
        >
          {cats.map((c, idx) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={onDragEnd}
              className={`relative rounded-xl border bg-white select-none transition-all ${
                draggingId === c.id
                  ? "opacity-40 ring-2 ring-accent scale-[0.98]"
                  : "border-nate-grey-200 hover:shadow-md"
              } ${!c.showInMenu ? "opacity-60" : ""}`}
            >
              {/* Image tile — the drag surface */}
              <div className="aspect-[4/3] bg-nate-grey-100 rounded-t-xl overflow-hidden relative cursor-move">
                {c.menuImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.menuImageUrl}
                      alt=""
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <button
                      onClick={() => clearImage(c)}
                      className="absolute top-1.5 right-1.5 bg-white/90 border border-nate-grey-200 rounded-full p-1 text-nate-grey-500 hover:text-red-600"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer text-nate-grey-400 hover:text-nate-grey-700">
                    {uploadingId === c.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    <span className="text-[10px]">Add image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(c, e.target.files?.[0])} />
                  </label>
                )}
                {c.menuHighlight && (
                  <span className="absolute top-1.5 left-1.5 bg-white/90 rounded-full p-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                  </span>
                )}
                <GripVertical className="absolute bottom-1.5 right-1.5 w-4 h-4 text-white/80 drop-shadow pointer-events-none" />
                {!c.showInMenu && (
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] uppercase tracking-wide bg-nate-grey-800/80 text-white px-1.5 py-0.5 rounded">
                    Hidden
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="p-2.5">
                <p className="text-sm font-medium text-nate-grey-800 truncate">{c.name}</p>
                <p className="text-[10px] text-nate-grey-400 font-mono truncate">{c.slug}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setField(c, "showInMenu", !c.showInMenu)}
                    className={`inline-flex items-center gap-1 text-[11px] ${c.showInMenu ? "text-nate-grey-700 hover:text-nate-grey-900" : "text-nate-grey-400 hover:text-nate-grey-600"}`}
                    title={c.showInMenu ? "Shown in menu — click to hide" : "Hidden — click to show"}
                  >
                    {c.showInMenu ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {c.showInMenu ? "Shown" : "Hidden"}
                  </button>
                  <button
                    onClick={() => setField(c, "menuHighlight", !c.menuHighlight)}
                    className={`inline-flex items-center gap-1 text-[11px] ${c.menuHighlight ? "text-amber-600" : "text-nate-grey-400 hover:text-nate-grey-600"}`}
                    title="Highlight this category in the menu"
                  >
                    <Star className={`w-3.5 h-3.5 ${c.menuHighlight ? "fill-amber-400 text-amber-500" : ""}`} />
                    Highlight
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

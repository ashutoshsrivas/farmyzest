"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Copy,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { uploadProductImage } from "@/lib/upload-image";
import { uploadVideo } from "@/lib/upload-video";
import {
  SECTION_META,
  SECTION_ORDER,
  type HomeSectionType,
  type FieldDef,
  type VideoReelItem,
} from "@/lib/home-sections";

interface Section {
  id: string;
  type: HomeSectionType;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
}
interface Opt {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

export function LandingBuilder({
  sections: initial,
  collections,
  categories,
}: {
  sections: Section[];
  collections: Opt[];
  categories: Opt[];
}) {
  const [sections, setSections] = useState<Section[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  async function api(method: string, body?: unknown, qs = "") {
    const res = await fetch(`/api/admin/home-sections${qs}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Request failed");
    return data;
  }

  async function initDefault() {
    setBusy(true);
    try {
      await fetch("/api/admin/home-sections"); // GET auto-seeds defaults
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(s: Section) {
    setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await api("PUT", { id: s.id, enabled: !s.enabled });
    } catch {
      setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: s.enabled } : x)));
      toast.error("Could not update");
    }
  }

  async function persistOrder(next: Section[]) {
    setSections(next);
    try {
      await api("POST", { ids: next.map((s) => s.id) }, "/reorder");
    } catch {
      toast.error("Could not save order");
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    persistOrder(next);
  }

  async function addSection(type: HomeSectionType) {
    setAdding(false);
    setBusy(true);
    try {
      const { section } = await api("POST", { type });
      setSections((prev) => [...prev, section]);
      setEditingId(section.id);
      toast.success(`Added ${SECTION_META[type].label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(s: Section) {
    setBusy(true);
    try {
      const { section } = await api("POST", { type: s.type, config: s.config });
      setSections((prev) => [...prev, section]);
      toast.success("Duplicated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Section) {
    if (!confirm(`Delete this ${SECTION_META[s.type].label} section?`)) return;
    setSections((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await api("DELETE", undefined, `?id=${s.id}`);
    } catch {
      toast.error("Could not delete");
    }
  }

  async function saveConfig(id: string, config: Record<string, unknown>) {
    setSections((prev) => prev.map((x) => (x.id === id ? { ...x, config } : x)));
    await api("PUT", { id, config });
  }

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <p className="text-nate-grey-500 mb-4">
          Your homepage is using the built-in default layout. Initialise it to start editing.
        </p>
        <button
          onClick={initDefault}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Initialise from current layout
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-nate-grey-500">
        Reorder, show/hide, edit, duplicate or remove the blocks that make up your homepage. Changes
        go live immediately.
      </p>

      {sections.map((s, idx) => {
        const meta = SECTION_META[s.type];
        const isEditing = editingId === s.id;
        return (
          <div key={s.id} className="bg-white rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Move */}
              <div className="flex flex-col">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === sections.length - 1}
                  className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium ${s.enabled ? "text-nate-grey-800" : "text-nate-grey-400"}`}>
                  {meta.label}
                  {!s.enabled && <span className="ml-2 text-[11px] uppercase tracking-wide text-nate-grey-400">Hidden</span>}
                </p>
                <p className="text-xs text-nate-grey-400 truncate">{meta.description}</p>
              </div>

              <button
                onClick={() => toggleEnabled(s)}
                title={s.enabled ? "Hide from homepage" : "Show on homepage"}
                className="text-nate-grey-500 hover:text-nate-grey-900 p-1.5"
              >
                {s.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setEditingId(isEditing ? null : s.id)}
                title="Edit content"
                className={`p-1.5 ${isEditing ? "text-accent" : "text-nate-grey-500 hover:text-nate-grey-900"}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => duplicate(s)} title="Duplicate" className="text-nate-grey-500 hover:text-nate-grey-900 p-1.5">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => remove(s)} title="Delete" className="text-nate-grey-400 hover:text-red-600 p-1.5">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {isEditing && (
              <SectionEditor
                section={s}
                fields={meta.fields}
                collections={collections}
                categories={categories}
                onSave={async (cfg) => {
                  await saveConfig(s.id, cfg);
                  toast.success("Saved");
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            )}
          </div>
        );
      })}

      {/* Add section */}
      <div className="relative">
        <button
          onClick={() => setAdding((a) => !a)}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add section
        </button>
        {adding && (
          <div className="absolute z-20 mt-1 bg-white border border-nate-grey-200 rounded-lg shadow-lg py-1 w-64">
            {SECTION_ORDER.map((t) => (
              <button
                key={t}
                onClick={() => addSection(t)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-nate-grey-50"
              >
                <span className="font-medium text-nate-grey-800">{SECTION_META[t].label}</span>
                <span className="block text-xs text-nate-grey-400">{SECTION_META[t].description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  fields,
  collections,
  categories,
  onSave,
  onCancel,
}: {
  section: Section;
  fields: FieldDef[];
  collections: Opt[];
  categories: Opt[];
  onSave: (cfg: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [cfg, setCfg] = useState<Record<string, unknown>>({ ...section.config });
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const set = (k: string, v: unknown) => setCfg((p) => ({ ...p, [k]: v }));
  const sv = (k: string) => (typeof cfg[k] === "string" ? (cfg[k] as string) : "");

  async function onFile(key: string, file: File | undefined) {
    if (!file) return;
    setUploadingKey(key);
    try {
      const url = await uploadProductImage(file, "home");
      set(key, url);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <div className="border-t border-nate-grey-100 bg-nate-grey-50 px-4 py-4 space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-nate-grey-600 mb-1">{f.label}</label>

          {f.type === "textarea" ? (
            <textarea
              value={sv(f.key)}
              onChange={(e) => set(f.key, e.target.value)}
              rows={3}
              placeholder={f.placeholder}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            />
          ) : f.type === "number" ? (
            <input
              type="text" inputMode="decimal"
              value={typeof cfg[f.key] === "number" ? (cfg[f.key] as number) : ""}
              onChange={(e) => set(f.key, e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
              placeholder={f.placeholder}
              className="w-32 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            />
          ) : f.type === "collection" ? (
            <select
              value={sv(f.key)}
              onChange={(e) => set(f.key, e.target.value || undefined)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Auto (homepage-ranked)</option>
              {collections.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          ) : f.type === "category" ? (
            <select
              value={sv(f.key)}
              onChange={(e) => set(f.key, e.target.value || undefined)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          ) : f.type === "categoryMulti" ? (
            <div className="border border-nate-grey-200 rounded-lg bg-white max-h-40 overflow-y-auto p-2 space-y-1">
              {categories.map((c) => {
                const arr = Array.isArray(cfg[f.key]) ? (cfg[f.key] as string[]) : [];
                const checked = arr.includes(c.slug);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-nate-grey-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        set(
                          f.key,
                          e.target.checked ? [...arr, c.slug] : arr.filter((x) => x !== c.slug)
                        )
                      }
                      className="accent-black"
                    />
                    {c.parentId ? `↳ ${c.name}` : c.name}
                  </label>
                );
              })}
            </div>
          ) : f.type === "videoList" ? (
            <VideoListEditor
              items={Array.isArray(cfg[f.key]) ? (cfg[f.key] as VideoReelItem[]) : []}
              categories={categories}
              onChange={(items) => set(f.key, items)}
            />
          ) : f.type === "image" ? (
            <div className="flex items-center gap-3">
              {sv(f.key) ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sv(f.key)} alt="" className="w-20 h-20 object-cover rounded-lg border border-nate-grey-200" />
                  <button
                    onClick={() => set(f.key, undefined)}
                    className="absolute -top-2 -right-2 bg-white border border-nate-grey-200 rounded-full p-0.5 text-nate-grey-500 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-nate-grey-300 rounded-lg text-sm text-nate-grey-700 cursor-pointer hover:bg-nate-grey-100">
                {uploadingKey === f.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {sv(f.key) ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(f.key, e.target.files?.[0])}
                />
              </label>
            </div>
          ) : (
            <input
              type="text"
              value={sv(f.key)}
              onChange={(e) => set(f.key, e.target.value || undefined)}
              placeholder={f.placeholder}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
          {f.help && <p className="text-[11px] text-nate-grey-400 mt-1">{f.help}</p>}
        </div>
      ))}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-900">
          Cancel
        </button>
        <button
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(cfg);
            } catch {
              toast.error("Save failed");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

// Editor for a VIDEO_REELS section's `items`: upload vertical clips, label each,
// and link each to a category. Order = display order on the homepage.
function VideoListEditor({
  items,
  categories,
  onChange,
}: {
  items: VideoReelItem[];
  categories: Opt[];
  onChange: (items: VideoReelItem[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const added: VideoReelItem[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadVideo(file, "reel");
        added.push({ videoUrl: url });
      }
      onChange([...items, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const update = (i: number, patch: Partial<VideoReelItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start border border-nate-grey-200 rounded-lg bg-white p-2">
          <video src={it.videoUrl} muted playsInline className="w-12 h-16 object-cover rounded bg-nate-grey-100 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <input
              value={it.label ?? ""}
              onChange={(e) => update(i, { label: e.target.value || undefined })}
              placeholder="Label (e.g. Sarees)"
              className="w-full border border-nate-grey-200 rounded px-2 py-1 text-sm bg-white"
            />
            <select
              value={it.href ?? ""}
              onChange={(e) => update(i, { href: e.target.value || undefined })}
              className="w-full border border-nate-grey-200 rounded px-2 py-1 text-sm bg-white"
            >
              <option value="">No link</option>
              {categories.map((c) => (
                <option key={c.id} value={`/shop?category=${c.slug}`}>
                  {c.parentId ? `↳ ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => remove(i)} className="text-nate-grey-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <label className="inline-flex items-center gap-2 px-3 py-2 border border-nate-grey-300 rounded-lg text-sm text-nate-grey-700 cursor-pointer hover:bg-nate-grey-100">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Add video(s)
        <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </label>
      <p className="text-[11px] text-nate-grey-400">Vertical clips work best · muted autoplay on the site · max 60&nbsp;MB each.</p>
    </div>
  );
}

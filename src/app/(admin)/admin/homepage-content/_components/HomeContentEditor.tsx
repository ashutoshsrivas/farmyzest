"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Plus, Trash2 } from "lucide-react";
import { uploadProductImage } from "@/lib/upload-image";
import type { HomeContent, SowingSeason } from "@/lib/home-content";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inputCls =
  "w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent";

// ── Small field components ───────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  hint,
  multiline = false,
  max,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  multiline?: boolean;
  max?: number;
  mono?: boolean;
}) {
  const cls = `${inputCls} ${mono ? "font-mono" : ""}`;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-nate-grey-700 mb-1">{label}</span>
      {multiline ? (
        <textarea className={`${cls} min-h-[84px]`} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="block text-xs text-nate-grey-400 mt-1">{hint}</span>}
    </label>
  );
}

function ImageField({
  label,
  value,
  onChange,
  alt,
  onAlt,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  alt?: string;
  onAlt?: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      onChange(await uploadProductImage(file, "homepage"));
    } catch {
      setErr("Upload failed. Check the S3 settings, or paste an image link instead.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-nate-grey-100 text-nate-grey-400 hover:text-nate-grey-700"
        aria-label={`Upload ${label}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-xs">
            <ImagePlus className="h-5 w-5" /> Add photo
          </span>
        )}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-nate-grey-700">Uploading…</span>}
      </button>
      <div className="space-y-3">
        <Field label={label} value={value} onChange={onChange} mono hint="Upload with the picture, or paste an https:// image link." />
        {onAlt && <Field label="Describe the photo (for screen readers)" value={alt ?? ""} onChange={onAlt} />}
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}

function Section({ title, hint, children, defaultOpen = false }: { title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group bg-white rounded-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4">
        <span>
          <span className="block text-base font-medium text-nate-grey-800">{title}</span>
          {hint && <span className="block text-xs text-nate-grey-400 mt-0.5">{hint}</span>}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-nate-grey-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-nate-grey-100 px-6 py-5">{children}</div>
    </details>
  );
}

function RowTools({ onUp, onDown, onRemove, first, last, label }: { onUp: () => void; onDown: () => void; onRemove: () => void; first: boolean; last: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onUp} disabled={first} aria-label={`Move ${label} up`} className="p-1.5 text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={onDown} disabled={last} aria-label={`Move ${label} down`} className="p-1.5 text-nate-grey-400 hover:text-nate-grey-800 disabled:opacity-30">
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="p-1.5 text-nate-grey-400 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-nate-grey-300 px-3 py-2 text-sm text-nate-grey-600 hover:border-nate-grey-500 hover:text-nate-grey-900 disabled:opacity-40"
    >
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ── Editor ────────────────────────────────────────────────────────────────

export function HomeContentEditor({ initial }: { initial: HomeContent }) {
  const [c, setC] = useState<HomeContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** Immutable update: mutate a deep copy, then store it. */
  function edit(fn: (d: HomeContent) => void) {
    setC((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });
    setDirty(true);
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/homepage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setC(data.content);
      setDirty(false);
      setMsg({ ok: true, text: "Saved. The homepage shows the changes now." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!window.confirm("Put every homepage text and photo back to the original? Your edits here will be lost. Shop by need cards are not affected.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/homepage", { method: "DELETE" });
      const data = await res.json();
      setC(data.content);
      setDirty(false);
      setMsg({ ok: true, text: "Restored the original homepage content." });
    } finally {
      setSaving(false);
    }
  }

  const season = (si: number, fn: (s: SowingSeason) => void) => edit((d) => fn(d.sowing.seasons[si]));

  return (
    <div className="space-y-4 pb-28">
      <Section title="1 · Garden landscape (top of the page)" hint="Shown when the garden landscape is on in Settings." defaultOpen>
        <Field label="Small line above the headline" value={c.landscape.eyebrow} max={160} onChange={(v) => edit((d) => { d.landscape.eyebrow = v; })} />
        <Field label="Headline" value={c.landscape.headline} max={160} onChange={(v) => edit((d) => { d.landscape.headline = v; })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Signpost: Garden board" value={c.landscape.gardenSign} max={24} onChange={(v) => edit((d) => { d.landscape.gardenSign = v; })} />
          <Field label="Signpost: Farm board" value={c.landscape.farmSign} max={24} onChange={(v) => edit((d) => { d.landscape.farmSign = v; })} />
        </div>
      </Section>

      <Section title="2 · Shop by need" hint="Heading only. The cards are on the Shop by Need page.">
        <Field label="Heading" value={c.shopByNeed.title} max={160} onChange={(v) => edit((d) => { d.shopByNeed.title = v; })} />
        <Field label="Line under the heading" value={c.shopByNeed.intro} max={160} onChange={(v) => edit((d) => { d.shopByNeed.intro = v; })} />
        <Link href="/admin/shop-by-need" className="inline-block text-sm text-accent underline">Edit the Shop by need cards →</Link>
      </Section>

      <Section title="3 · Introduction" hint="The large statement with the leaf drawing.">
        <Field label="Small line above" value={c.intro.eyebrow} max={160} onChange={(v) => edit((d) => { d.intro.eyebrow = v; })} />
        <Field label="Statement" value={c.intro.statement} multiline max={900} onChange={(v) => edit((d) => { d.intro.statement = v; })} />
        <label className="flex items-center gap-2 text-sm text-nate-grey-700">
          <input type="checkbox" className="h-4 w-4 accent-black" checked={c.intro.showStats} onChange={(e) => edit((d) => { d.intro.showStats = e.target.checked; })} />
          Show the counters (years trading, departments, categories — calculated automatically)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link text" value={c.intro.linkLabel} max={60} onChange={(v) => edit((d) => { d.intro.linkLabel = v; })} hint="Leave empty to hide the link." />
          <Field label="Link goes to" value={c.intro.linkHref} mono onChange={(v) => edit((d) => { d.intro.linkHref = v; })} />
        </div>
      </Section>

      <Section title="4 · Garden and Farm photo panels" hint="The two large photos that lead to each side of the shop.">
        {(["garden", "farm"] as const).map((k) => (
          <div key={k} className="space-y-4 rounded-lg border border-nate-grey-100 p-4">
            <p className="text-sm font-semibold text-nate-grey-800">{k === "garden" ? "Garden panel" : "Farm panel"}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tag" value={c.panels[k].kicker} max={40} onChange={(v) => edit((d) => { d.panels[k].kicker = v; })} />
              <Field label="Button text" value={c.panels[k].cta} max={40} onChange={(v) => edit((d) => { d.panels[k].cta = v; })} />
            </div>
            <Field label="Headline" value={c.panels[k].headline} max={160} onChange={(v) => edit((d) => { d.panels[k].headline = v; })} />
            <Field label="Text" value={c.panels[k].body} multiline max={900} onChange={(v) => edit((d) => { d.panels[k].body = v; })} />
            <ImageField
              label="Photo"
              value={c.panels[k].image}
              onChange={(v) => edit((d) => { d.panels[k].image = v; })}
              alt={c.panels[k].alt}
              onAlt={(v) => edit((d) => { d.panels[k].alt = v; })}
            />
          </div>
        ))}
      </Section>

      <Section title="5 · Full catalogue" hint="The department photo grid. Department names and photos are edited under Categories.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading" value={c.catalogue.title} max={160} onChange={(v) => edit((d) => { d.catalogue.title = v; })} />
          <Field label="Link text" value={c.catalogue.linkLabel} max={60} onChange={(v) => edit((d) => { d.catalogue.linkLabel = v; })} hint="Leave empty to hide the link." />
        </div>
      </Section>

      <Section title="6 · What to sow this month" hint="The page shows the season that contains the current month.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading start (month name is added)" value={c.sowing.titlePrefix} max={60} onChange={(v) => edit((d) => { d.sowing.titlePrefix = v; })} />
        </div>
        <Field label="Note on the photo" value={c.sowing.note} multiline max={900} onChange={(v) => edit((d) => { d.sowing.note = v; })} />
        <ImageField label="Photo" value={c.sowing.image} onChange={(v) => edit((d) => { d.sowing.image = v; })} alt={c.sowing.imageAlt} onAlt={(v) => edit((d) => { d.sowing.imageAlt = v; })} />
        {c.sowing.seasons.map((s, si) => (
          <div key={si} className="space-y-4 rounded-lg border border-nate-grey-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-nate-grey-800">Season {si + 1}: {s.name || "Untitled"}</p>
              {c.sowing.seasons.length > 1 && (
                <button type="button" onClick={() => edit((d) => { d.sowing.seasons.splice(si, 1); })} className="text-xs text-nate-grey-500 hover:text-red-600">
                  Remove season
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Season name" value={s.name} max={60} onChange={(v) => season(si, (x) => { x.name = v; })} />
              <Field label="Sowing window" value={s.window} max={80} onChange={(v) => season(si, (x) => { x.window = v; })} />
            </div>
            <div>
              <span className="block text-sm font-medium text-nate-grey-700 mb-1">Months</span>
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((m, mi) => {
                  const on = s.months.includes(mi + 1);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => season(si, (x) => { x.months = on ? x.months.filter((n) => n !== mi + 1) : [...x.months, mi + 1].sort((a, b) => a - b); })}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-accent text-white" : "bg-nate-grey-100 text-nate-grey-600 hover:bg-nate-grey-200"}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium text-nate-grey-700">Vegetables</span>
              {s.crops.map((cr, ci) => (
                <div key={ci} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1.2fr_1fr_auto]">
                  <Field label="Name" value={cr.name} max={60} onChange={(v) => season(si, (x) => { x.crops[ci].name = v; })} />
                  <Field label="Local name" value={cr.local} max={60} onChange={(v) => season(si, (x) => { x.crops[ci].local = v; })} />
                  <label className="block">
                    <span className="block text-sm font-medium text-nate-grey-700 mb-1">How to sow</span>
                    <select className={inputCls} value={cr.how} onChange={(e) => season(si, (x) => { x.crops[ci].how = e.target.value as typeof cr.how; })}>
                      <option>Direct sow</option>
                      <option>Nursery, then transplant</option>
                    </select>
                  </label>
                  <Field label="Search word" value={cr.q} max={60} onChange={(v) => season(si, (x) => { x.crops[ci].q = v; })} />
                  <RowTools
                    label={cr.name || "vegetable"}
                    first={ci === 0}
                    last={ci === s.crops.length - 1}
                    onUp={() => season(si, (x) => { x.crops = move(x.crops, ci, -1); })}
                    onDown={() => season(si, (x) => { x.crops = move(x.crops, ci, 1); })}
                    onRemove={() => season(si, (x) => { x.crops.splice(ci, 1); })}
                  />
                </div>
              ))}
              <AddButton disabled={s.crops.length >= 20} onClick={() => season(si, (x) => { x.crops.push({ name: "", local: "", how: "Direct sow", q: "" }); })}>
                Add vegetable
              </AddButton>
            </div>
            <Field
              label="Flowers to sow (separate with commas)"
              value={s.flowers.join(", ")}
              onChange={(v) => season(si, (x) => { x.flowers = v.split(",").map((f) => f.trim()).filter(Boolean).slice(0, 12); })}
            />
          </div>
        ))}
        <AddButton
          disabled={c.sowing.seasons.length >= 6}
          onClick={() => edit((d) => { d.sowing.seasons.push({ name: "New season", window: "", months: [], crops: [], flowers: [] }); })}
        >
          Add season
        </AddButton>
      </Section>

      <Section title="7 · Product row" hint="Products come from the catalogue: the Bestsellers collection, or the newest products.">
        <Field label="Heading when browsing Garden (Bestsellers collection)" value={c.products.gardenTitle} max={160} onChange={(v) => edit((d) => { d.products.gardenTitle = v; })} />
        <Field label="Heading when browsing Farm (Bestsellers collection)" value={c.products.farmTitle} max={160} onChange={(v) => edit((d) => { d.products.farmTitle = v; })} />
        <Field label="Heading when showing newest products" value={c.products.newTitle} max={160} onChange={(v) => edit((d) => { d.products.newTitle = v; })} />
      </Section>

      <Section title="8 · Our story band" hint="The dark photo band with the big year.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Small heading" value={c.heritage.title} max={160} onChange={(v) => edit((d) => { d.heritage.title = v; })} />
          <Field label="Big year" value={c.heritage.bigYear} max={12} onChange={(v) => edit((d) => { d.heritage.bigYear = v; })} />
        </div>
        <Field label="Story" value={c.heritage.body} multiline max={900} onChange={(v) => edit((d) => { d.heritage.body = v; })} />
        <Field label="Button text" value={c.heritage.linkLabel} max={60} onChange={(v) => edit((d) => { d.heritage.linkLabel = v; })} />
        <div className="space-y-2">
          <span className="block text-sm font-medium text-nate-grey-700">Milestones</span>
          {c.heritage.milestones.map((m, mi) => (
            <div key={mi} className="grid items-end gap-2 sm:grid-cols-[120px_1fr_auto]">
              <Field label="Year" value={m.year} max={12} onChange={(v) => edit((d) => { d.heritage.milestones[mi].year = v; })} />
              <Field label="What happened" value={m.text} max={160} onChange={(v) => edit((d) => { d.heritage.milestones[mi].text = v; })} />
              <RowTools
                label={m.year || "milestone"}
                first={mi === 0}
                last={mi === c.heritage.milestones.length - 1}
                onUp={() => edit((d) => { d.heritage.milestones = move(d.heritage.milestones, mi, -1); })}
                onDown={() => edit((d) => { d.heritage.milestones = move(d.heritage.milestones, mi, 1); })}
                onRemove={() => edit((d) => { d.heritage.milestones.splice(mi, 1); })}
              />
            </div>
          ))}
          <AddButton disabled={c.heritage.milestones.length >= 12} onClick={() => edit((d) => { d.heritage.milestones.push({ year: "", text: "" }); })}>
            Add milestone
          </AddButton>
        </div>
        <ImageField label="Background photo" value={c.heritage.image} onChange={(v) => edit((d) => { d.heritage.image = v; })} alt={c.heritage.imageAlt} onAlt={(v) => edit((d) => { d.heritage.imageAlt = v; })} />
        <ImageField label="Framed photo" value={c.heritage.inset} onChange={(v) => edit((d) => { d.heritage.inset = v; })} alt={c.heritage.insetAlt} onAlt={(v) => edit((d) => { d.heritage.insetAlt = v; })} />
      </Section>

      <Section title="9 · Field notes" hint="Short buying tips with a photo each. Remove all to hide the section.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading" value={c.notes.title} max={160} onChange={(v) => edit((d) => { d.notes.title = v; })} />
          <Field label="Line under the heading" value={c.notes.intro} max={160} onChange={(v) => edit((d) => { d.notes.intro = v; })} />
        </div>
        {c.notes.items.map((n, ni) => (
          <div key={ni} className="space-y-4 rounded-lg border border-nate-grey-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-nate-grey-800">Note {ni + 1}</p>
              <RowTools
                label={n.title || `note ${ni + 1}`}
                first={ni === 0}
                last={ni === c.notes.items.length - 1}
                onUp={() => edit((d) => { d.notes.items = move(d.notes.items, ni, -1); })}
                onDown={() => edit((d) => { d.notes.items = move(d.notes.items, ni, 1); })}
                onRemove={() => edit((d) => { d.notes.items.splice(ni, 1); })}
              />
            </div>
            <Field label="Title" value={n.title} max={160} onChange={(v) => edit((d) => { d.notes.items[ni].title = v; })} />
            <Field label="Text" value={n.body} multiline max={900} onChange={(v) => edit((d) => { d.notes.items[ni].body = v; })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link text" value={n.linkLabel} max={60} onChange={(v) => edit((d) => { d.notes.items[ni].linkLabel = v; })} />
              <Field label="Link goes to" value={n.href} mono onChange={(v) => edit((d) => { d.notes.items[ni].href = v; })} />
            </div>
            <ImageField label="Photo" value={n.image} onChange={(v) => edit((d) => { d.notes.items[ni].image = v; })} />
          </div>
        ))}
        <AddButton
          disabled={c.notes.items.length >= 6}
          onClick={() => edit((d) => { d.notes.items.push({ title: "", body: "", image: "", linkLabel: "", href: "" }); })}
        >
          Add note
        </AddButton>
      </Section>

      <Section title="10 · Ask us (contact band)" hint="WhatsApp and phone buttons appear when their numbers are set in Settings.">
        <Field label="Small heading" value={c.ask.eyebrow} max={160} onChange={(v) => edit((d) => { d.ask.eyebrow = v; })} />
        <Field label="Headline" value={c.ask.headline} max={160} onChange={(v) => edit((d) => { d.ask.headline = v; })} />
        <Field label="Text" value={c.ask.body} multiline max={900} onChange={(v) => edit((d) => { d.ask.body = v; })} />
        <Field label="Contact page button text" value={c.ask.contactLabel} max={60} onChange={(v) => edit((d) => { d.ask.contactLabel = v; })} />
        <ImageField label="Background photo" value={c.ask.image} onChange={(v) => edit((d) => { d.ask.image = v; })} alt={c.ask.imageAlt} onAlt={(v) => edit((d) => { d.ask.imageAlt = v; })} />
      </Section>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-nate-grey-200 bg-white/95 backdrop-blur md:left-64">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p role="status" className={`text-sm ${msg ? (msg.ok ? "text-green-700" : "text-red-600") : "text-nate-grey-500"}`}>
            {msg ? msg.text : dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={restore} disabled={saving} className="px-4 py-2 text-sm text-nate-grey-600 hover:text-nate-grey-900 disabled:opacity-50">
              Restore original
            </button>
            <button type="button" onClick={save} disabled={saving || !dirty} className="rounded-lg bg-accent px-5 py-2 text-sm text-white hover:bg-accent-dark disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

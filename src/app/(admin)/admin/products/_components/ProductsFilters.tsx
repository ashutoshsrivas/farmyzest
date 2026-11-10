"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";

// URL-driven product filters (shareable / bookmarkable; the server component
// reads them straight off the query string). Mirrors the OrdersFilters pattern.

interface CategoryOpt {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

const FILTER_KEYS = ["q", "category", "brand", "collection", "status", "location", "website", "images", "season", "gender", "stock"];

interface CollectionOpt {
  id: string;
  name: string;
  slug: string;
}

export function ProductsFilters({
  categories,
  collections = [],
  brands = [],
}: {
  categories: CategoryOpt[];
  collections?: CollectionOpt[];
  brands?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local mirror for the search box (source of truth while typing). We push to
  // the URL live (debounced) so the list filters as you type; reset() clears it.
  const [qLocal, setQLocal] = useState(searchParams.get("q") ?? "");

  // Live search: debounce-push the query on every keystroke (300ms idle).
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (qLocal.trim() === current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const v = qLocal.trim();
      if (v) params.set("q", v);
      else params.delete("q");
      params.delete("page");
      router.push(`/admin/products?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v.length > 0) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // reset pagination when filters change
    router.push(`/admin/products?${params.toString()}`);
  }

  function reset() {
    setQLocal("");
    router.push("/admin/products");
  }

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  const selectCls =
    "border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-nate-grey-400";

  // Build a hierarchical category option list (parent, then indented children).
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const catOptions: { value: string; label: string }[] = [];
  for (const r of roots) {
    catOptions.push({ value: r.slug, label: r.name });
    for (const c of childrenOf(r.id)) catOptions.push({ value: c.slug, label: `— ${c.name}` });
  }
  const brandOptions = brands.map((b) => ({ value: b, label: b }));
  const collectionOptions = collections.map((c) => ({ value: c.slug, label: c.name }));

  return (
    <div className="bg-white rounded-xl p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-56">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
            <input
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && update({ q: qLocal.trim() || null })}
              placeholder="Name, slug, brand, or SKU…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-nate-grey-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
            />
          </div>
        </div>

        {/* Sort by */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Sort by</label>
          <select className={selectCls} value={searchParams.get("sort") || "newest"} onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })}>
            <option value="newest">Latest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="price">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="category">Category A–Z</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Category — searchable */}
        <Combo
          label="Category"
          allLabel="All categories"
          value={searchParams.get("category") || ""}
          options={catOptions}
          onChange={(v) => update({ category: v })}
        />

        {/* Brand — searchable */}
        {brands.length > 0 && (
          <Combo
            label="Brand"
            allLabel="All brands"
            value={searchParams.get("brand") || ""}
            options={brandOptions}
            onChange={(v) => update({ brand: v })}
          />
        )}

        {/* Collection — searchable */}
        {collections.length > 0 && (
          <Combo
            label="Collection"
            allLabel="All collections"
            value={searchParams.get("collection") || ""}
            options={collectionOptions}
            onChange={(v) => update({ collection: v })}
          />
        )}

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Status</label>
          <select className={selectCls} value={searchParams.get("status") || ""} onChange={(e) => update({ status: e.target.value || null })}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Location</label>
          <select className={selectCls} value={searchParams.get("location") || ""} onChange={(e) => update({ location: e.target.value || null })}>
            <option value="">All locations</option>
            <option value="STORE">Store</option>
            <option value="GODOWN">Godown</option>
          </select>
        </div>

        {/* Website visibility */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Website</label>
          <select className={selectCls} value={searchParams.get("website") || ""} onChange={(e) => update({ website: e.target.value || null })}>
            <option value="">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>

        {/* Images */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Images</label>
          <select className={selectCls} value={searchParams.get("images") || ""} onChange={(e) => update({ images: e.target.value || null })}>
            <option value="">Any</option>
            <option value="with">With image</option>
            <option value="without">No image</option>
          </select>
        </div>

        {/* Season */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Season</label>
          <select className={selectCls} value={searchParams.get("season") || ""} onChange={(e) => update({ season: e.target.value || null })}>
            <option value="">All seasons</option>
            <option value="ALL">All-season</option>
            <option value="SUMMER">Summer</option>
            <option value="WINTER">Winter</option>
          </select>
        </div>

        {/* Audience (gender) */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Audience</label>
          <select className={selectCls} value={searchParams.get("gender") || ""} onChange={(e) => update({ gender: e.target.value || null })}>
            <option value="">All</option>
            <option value="MEN">Men</option>
            <option value="WOMEN">Women</option>
            <option value="UNISEX">Unisex</option>
          </select>
        </div>

        {/* Stock */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Stock</label>
          <select className={selectCls} value={searchParams.get("stock") || ""} onChange={(e) => update({ stock: e.target.value || null })}>
            <option value="">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-sm text-nate-grey-500 hover:text-nate-grey-800 px-3 py-2"
          >
            <X className="w-4 h-4" />
            Clear {activeCount}
          </button>
        )}
      </div>
    </div>
  );
}

// Searchable single-select: type to filter the options, pick from the list
// below. Returns the chosen value (or null to clear) via onChange.
function Combo({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">{label}</label>
      <div className="relative w-44">
        <input
          value={open ? query : selected?.label ?? ""}
          placeholder={allLabel}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="w-full border border-nate-grey-200 rounded-lg pl-3 pr-7 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
        {value && !open ? (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              pick(null);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-nate-grey-400 hover:text-nate-grey-700"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nate-grey-400 pointer-events-none" />
        )}

        {open && (
          <div className="absolute z-30 top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-nate-grey-200 rounded-lg shadow-lg py-1">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(null);
              }}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-nate-grey-50 ${!value ? "text-nate-grey-900 font-medium" : "text-nate-grey-500"}`}
            >
              {allLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.value);
                }}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-nate-grey-50 ${o.value === value ? "bg-nate-grey-50 text-nate-grey-900 font-medium" : "text-nate-grey-700"}`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-xs text-nate-grey-400">No matches</div>}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, PackageX, Volume2, SlidersHorizontal, X, ChevronDown, Check } from "lucide-react";

interface CategoryOpt {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface Variant {
  id: string;
  sku: string;
  barcode: string;
  label: string;
  stock: number;
  low: boolean;
}
interface Product {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  totalStock: number;
  variants: Variant[];
}

type Opt = { value: string; label: string };

// Loud, clear "out of stock" spoken alert (same behaviour as the POS).
function speakOutOfStock() {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance("Out of stock");
    u.volume = 1;
    u.rate = 0.95;
    u.lang = "en-IN";
    synth.speak(u);
  } catch {
    /* speech unavailable */
  }
}

function stockBadge(stock: number, low: boolean) {
  if (stock <= 0) return { text: "Out of stock", cls: "bg-red-100 text-red-700" };
  if (low) return { text: `${stock} left`, cls: "bg-amber-100 text-amber-700" };
  return { text: `${stock} in stock`, cls: "bg-green-100 text-green-700" };
}

const SORTS = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

const SEASON_OPTS: Opt[] = [
  { value: "ALL", label: "All-season" },
  { value: "SUMMER", label: "Summer" },
  { value: "WINTER", label: "Winter" },
];
const GENDER_OPTS: Opt[] = [
  { value: "MEN", label: "Men" },
  { value: "WOMEN", label: "Women" },
  { value: "UNISEX", label: "Unisex" },
];
const STOCK_OPTS: Opt[] = [
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

const EMPTY_FILTERS = { category: "", brand: "", size: "", color: "", season: "", gender: "", stock: "" };

export function ProductSearch({
  categories = [],
  brands = [],
  sizes = [],
  colors = [],
}: {
  categories?: CategoryOpt[];
  brands?: string[];
  sizes?: string[];
  colors?: string[];
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("latest");
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Sizes/colours narrow to what exists in the selected category/brand.
  const [availSizes, setAvailSizes] = useState<string[]>(sizes);
  const [availColors, setAvailColors] = useState<string[]>(colors);
  const [preview, setPreview] = useState<{ image: string; name: string } | null>(null);
  const reqId = useRef(0);
  const lastSpoken = useRef("");

  const activeCount = Object.values(filters).filter(Boolean).length;
  const setFilter = (k: keyof typeof EMPTY_FILTERS, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const categoryOpts: Opt[] = categories.map((c) => ({ value: c.slug, label: `${c.parentId ? "— " : ""}${c.name}` }));
  const brandOpts: Opt[] = brands.map((b) => ({ value: b, label: b }));
  const sizeOpts: Opt[] = availSizes.map((s) => ({ value: s, label: s }));
  const colorOpts: Opt[] = availColors.map((c) => ({ value: c, label: c }));

  // Refresh available sizes/colours whenever the category/brand selection changes.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.brand) params.set("brand", filters.brand);
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/store-board/facets?${params.toString()}`);
        const data = res.ok ? await res.json() : null;
        if (!active || !data) return;
        const ns: string[] = data.sizes ?? [];
        const nc: string[] = data.colors ?? [];
        setAvailSizes(ns);
        setAvailColors(nc);
        // Drop a chosen size/colour that no longer exists in the narrowed set.
        setFilters((f) => ({
          ...f,
          size: f.size && !ns.includes(f.size) ? "" : f.size,
          color: f.color && !nc.includes(f.color) ? "" : f.color,
        }));
      } catch {
        /* keep the previous options on error */
      }
    })();
    return () => {
      active = false;
    };
  }, [filters.category, filters.brand]);

  // Fetch stock for the current query + applied filters. Called both live (as
  // you type / change filters) and immediately on Search / Enter.
  const runSearch = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, sort });
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const res = await fetch(`/api/store-board/products?${params.toString()}`);
      const data = res.ok ? await res.json() : null;
      if (id !== reqId.current) return; // a newer search superseded this one
      setProducts(data?.products ?? []);
      setSearched(true);
      // Voice alert: an exact code hit that's out of stock.
      const exact = data?.exact as { stock: number } | null;
      if (exact && exact.stock <= 0 && lastSpoken.current !== q.trim().toLowerCase()) {
        lastSpoken.current = q.trim().toLowerCase();
        speakOutOfStock();
      }
    } catch {
      if (id === reqId.current) setProducts([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [q, sort, filters]);

  // Live search (debounced) whenever the query, sort or filters change.
  useEffect(() => {
    const handle = setTimeout(() => {
      void runSearch();
    }, 250);
    return () => clearTimeout(handle);
  }, [runSearch]);

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur();
            void runSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-nate-grey-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, brand, SKU or scan code"
              className="w-full bg-white border border-nate-grey-200 rounded-xl pl-11 pr-10 py-3 text-base focus:outline-none focus:ring-2 focus:ring-nate-grey-400"
              enterKeyHint="search"
              autoComplete="off"
            />
            {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-nate-grey-400 animate-spin" />}
          </div>
          <button
            type="submit"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold bg-nate-grey-900 text-white active:scale-[0.98]"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort by"
            className="flex-1 bg-white border border-nate-grey-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nate-grey-400"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>Sort: {s.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium border ${
              activeCount > 0 || showFilters
                ? "bg-nate-grey-900 text-white border-nate-grey-900"
                : "bg-white text-nate-grey-700 border-nate-grey-200"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white border border-nate-grey-200 rounded-xl p-3 grid grid-cols-2 gap-2">
            <SearchableSelect label="Category" placeholder="All categories" value={filters.category} options={categoryOpts} onChange={(v) => setFilter("category", v)} />
            <SearchableSelect label="Brand" placeholder="All brands" value={filters.brand} options={brandOpts} onChange={(v) => setFilter("brand", v)} />
            <SearchableSelect label="Size" placeholder="All sizes" value={filters.size} options={sizeOpts} onChange={(v) => setFilter("size", v)} />
            <SearchableSelect label="Color" placeholder="All colors" value={filters.color} options={colorOpts} onChange={(v) => setFilter("color", v)} />
            <SearchableSelect label="Stock" placeholder="Any stock" value={filters.stock} options={STOCK_OPTS} onChange={(v) => setFilter("stock", v)} />
            <SearchableSelect label="Season" placeholder="All seasons" value={filters.season} options={SEASON_OPTS} onChange={(v) => setFilter("season", v)} />
            <SearchableSelect label="Audience" placeholder="All" value={filters.gender} options={GENDER_OPTS} onChange={(v) => setFilter("gender", v)} />
            {activeCount > 0 && (
              <button
                onClick={() => setFilters({ ...EMPTY_FILTERS })}
                className="self-end inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-nate-grey-600 border border-nate-grey-200 hover:bg-nate-grey-50"
              >
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className="py-16 text-center text-nate-grey-400">
          <PackageX className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">{searched && (q || activeCount > 0) ? "No matches." : "Search to see stock."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-nate-grey-200 overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => p.imageUrl && setPreview({ image: p.imageUrl, name: p.name })}
                  disabled={!p.imageUrl}
                  aria-label={p.imageUrl ? "Tap to enlarge image" : "No image"}
                  className="w-12 h-12 rounded-lg bg-nate-grey-100 overflow-hidden shrink-0 relative disabled:cursor-default"
                >
                  {p.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 right-0 bg-nate-grey-900/70 text-white p-0.5 rounded-tl-md">
                        <Search className="w-2.5 h-2.5" />
                      </span>
                    </>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-nate-grey-900 text-sm leading-tight truncate">{p.name}</p>
                  <p className="text-xs text-nate-grey-400">
                    {p.brand ? `${p.brand} · ` : ""}
                    {p.variants.length} variant{p.variants.length === 1 ? "" : "s"} · {p.totalStock} in stock
                  </p>
                </div>
              </div>

              <div className="divide-y divide-nate-grey-100 border-t border-nate-grey-100">
                {p.variants.map((v) => {
                  const b = stockBadge(v.stock, v.low);
                  const oos = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => oos && speakOutOfStock()}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-nate-grey-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-nate-grey-800 truncate">{v.label}</p>
                        <p className="text-[11px] text-nate-grey-400 font-mono">{v.sku}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${b.cls}`}>
                        {oos && <Volume2 className="w-3 h-3" />}
                        {b.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tap-to-expand product image */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.image}
              alt={preview.name}
              className="w-full max-h-[75vh] object-contain rounded-xl bg-white"
            />
            <p className="text-white text-center text-sm mt-3">{preview.name}</p>
            <button
              onClick={() => setPreview(null)}
              className="mt-3 mx-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-white text-nate-grey-900"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// A dropdown that shows the full list AND a search box (the search box appears
// only when the list is long enough to need it). Selecting the placeholder row
// clears the filter.
function SearchableSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Opt[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const showSearch = options.length > 6;
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{label}</span>
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center justify-between gap-1 bg-white border rounded-lg px-2 py-2 text-sm text-left ${
            value ? "border-nate-grey-400 text-nate-grey-900" : "border-nate-grey-200 text-nate-grey-600"
          }`}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-nate-grey-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 left-0 right-0 bg-white border border-nate-grey-200 rounded-lg shadow-lg overflow-hidden">
            {showSearch && (
              <div className="p-1.5 border-b border-nate-grey-100">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="w-full bg-nate-grey-50 border border-nate-grey-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => pick("")}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${!value ? "text-nate-grey-900 font-medium" : "text-nate-grey-500"} hover:bg-nate-grey-50`}
              >
                {placeholder}
                {!value && <Check className="w-4 h-4 shrink-0" />}
              </button>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${o.value === value ? "text-nate-grey-900 font-medium bg-nate-grey-50" : "text-nate-grey-700"} hover:bg-nate-grey-50`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-xs text-nate-grey-400">No matches</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

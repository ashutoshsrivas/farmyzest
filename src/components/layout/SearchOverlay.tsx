"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

// Full-screen search overlay. Opens from the header search icon. Typing
// debounce-queries /api/products?search= and live-lists matching products as
// a grid of cards. Enter or clicking a result navigates to the PDP; the
// "See all results" footer goes to the filtered shop page.

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  onlinePrice: number | null;
  mrp: number;
  salePrice: number | null;
  images: { url: string }[];
  category: { name: string } | null;
}

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentParams = useSearchParams();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input + lock body scroll while open. Reset state on close.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // slight delay so the autofocus lands after mount transition
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      document.body.style.overflow = "";
      setQ("");
      setResults([]);
    }
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(term)}&limit=12`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.products ?? []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(slug: string) {
    onClose();
    router.push(`/shop/${slug}`);
  }

  function seeAll() {
    const term = q.trim();
    onClose();
    // Combine search WITH any filters already on the shop page (category,
    // size, colour, brand, price…). Starting from the current params when
    // we're on /shop preserves them; elsewhere we start clean.
    const params = new URLSearchParams(pathname === "/shop" ? currentParams.toString() : "");
    if (term) params.set("q", term);
    else params.delete("q");
    params.delete("page");
    router.push(`/shop${params.toString() ? `?${params.toString()}` : ""}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-white flex flex-col animate-fade-in">
      {/* Search bar */}
      <div className="border-b border-grey-200">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-5 flex items-center gap-4">
          <Search className="w-5 h-5 text-grey-400 shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") seeAll();
            }}
            placeholder="Search pieces, brands, collections…"
            className="flex-1 bg-transparent border-none outline-none text-base md:text-lg font-sans text-grey-900 placeholder:text-grey-400"
          />
          {loading && <Loader2 className="w-4 h-4 text-grey-400 animate-spin shrink-0" />}
          <button
            onClick={onClose}
            className="text-xs uppercase tracking-[0.1em] text-grey-500 hover:text-grey-900 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-8">
          {!q.trim() && (
            <p className="text-sm text-grey-400 font-sans">
              Start typing to search the catalogue.
            </p>
          )}

          {q.trim() && !loading && results.length === 0 && (
            <p className="text-sm text-grey-500 font-sans">
              No matches for <span className="font-medium text-grey-800">&ldquo;{q}&rdquo;</span>.
            </p>
          )}

          {results.length > 0 && (
            <>
              <p className="text-[11px] uppercase tracking-[0.15em] text-grey-400 mb-5">
                {results.length} result{results.length === 1 ? "" : "s"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                {results.map((p) => {
                  const price = p.onlinePrice ?? p.mrp;
                  // Special price = a sale/compare price sits above the sell price.
                  const isSpecial = p.salePrice != null && p.salePrice > price;
                  return (
                    <button
                      key={p.id}
                      onClick={() => go(p.slug)}
                      className="group text-left"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-grey-200">
                        {p.images[0]?.url ? (
                          <Image
                            src={p.images[0].url}
                            alt={p.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="20vw"
                          />
                        ) : (
                          <div className="w-full h-full bg-grey-200" />
                        )}
                      </div>
                      <div className="mt-2">
                        {p.category && (
                          <p className="text-[10px] uppercase tracking-[0.15em] text-grey-500">
                            {p.category.name}
                          </p>
                        )}
                        <p className="text-sm font-medium text-grey-800 line-clamp-1">
                          {p.name}
                        </p>
                        <p className="text-sm tabular-nums flex items-baseline gap-1.5">
                          <span className={`font-semibold ${isSpecial ? "price-special" : "text-grey-900"}`}>
                            ₹{price.toLocaleString("en-IN")}
                          </span>
                          {isSpecial && (
                            <span className="text-xs text-grey-400 line-through">
                              ₹{p.salePrice!.toLocaleString("en-IN")}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={seeAll}
                className="mt-8 text-xs font-sans font-medium uppercase tracking-[0.15em] text-grey-900 border-b border-grey-900 pb-0.5 hover:text-grey-600 hover:border-grey-600 transition-colors"
              >
                See all results →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

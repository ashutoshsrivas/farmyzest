"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus } from "lucide-react";

// Lightweight typeahead for the Product.brand field.
//
// Semantics: brand is stored as a free-form string on Product. This control
// queries /api/admin/brands for distinct existing values; whatever the
// admin types is also a valid choice — when the product is saved with that
// brand string, subsequent calls to the endpoint will include it. No
// separate Brand model is needed.
//
// Keyboard: ArrowDown / ArrowUp navigate, Enter selects highlighted (or the
// typed text if nothing is highlighted), Escape closes the menu.

interface BrandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional className for the outer wrapper. */
  className?: string;
  /** Disables the input. */
  disabled?: boolean;
}

export function BrandCombobox({
  value,
  onChange,
  placeholder = "Brand name (optional)",
  className,
  disabled,
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  // Fixed-position coords for the portal'd menu (so an overflow:hidden modal
  // ancestor can't clip it — the old absolute dropdown was being hidden).
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep the floating menu anchored under the input while open.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Fetch matches when the menu is open OR the value changes while focused.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL("/api/admin/brands", window.location.origin);
        if (value.trim()) url.searchParams.set("q", value.trim());
        url.searchParams.set("limit", "8");
        const res = await fetch(url.toString());
        if (!res.ok) {
          if (!cancelled) setMatches([]);
          return;
        }
        const data = await res.json();
        // /api/admin/brands now returns managed Brand OBJECTS ({ name, ... }),
        // not plain strings. Map them to names (tolerating a legacy string[]
        // shape too) — rendering/searching an object here previously crashed the
        // whole page. The endpoint returns the full list, so filter by the typed
        // query client-side and cap the list.
        const names: string[] = Array.isArray(data.brands)
          ? data.brands
              .map((b: unknown) => (typeof b === "string" ? b : (b as { name?: string })?.name))
              .filter((n: unknown): n is string => typeof n === "string" && n.length > 0)
          : [];
        const q = value.trim().toLowerCase();
        const list = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
        if (!cancelled) setMatches(list.slice(0, 8));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      // The menu is portal'd outside the wrapper, so check both.
      if (wrapperRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Whether the current typed value is already in the matches list. We
  // suppress the "+ Add" hint when the input exactly equals an existing
  // brand (case-insensitive) so the admin isn't tempted to create a dup.
  const typed = value.trim();
  const exactExists =
    typed.length > 0 &&
    matches.some((b) => b.toLowerCase() === typed.toLowerCase());

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && matches[highlight]) {
        e.preventDefault();
        onChange(matches[highlight]!);
        setOpen(false);
      }
      // Otherwise let the form submit / let the value stand as-is.
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(-1);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none disabled:bg-nate-grey-50"
        autoComplete="off"
      />

      {open && coords && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="bg-white border border-nate-grey-200 rounded-lg shadow-lg z-[120] max-h-64 overflow-y-auto"
        >
          {loading && matches.length === 0 && (
            <p className="px-3 py-2 text-xs text-nate-grey-400">Searching…</p>
          )}

          {!loading && matches.length === 0 && typed.length === 0 && (
            <p className="px-3 py-2 text-xs text-nate-grey-400">
              No brands in catalog yet — type one to create.
            </p>
          )}

          {matches.map((brand, i) => {
            const isHighlight = i === highlight;
            const isCurrent =
              brand.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={brand}
                type="button"
                onMouseDown={(e) => {
                  // mousedown so the input doesn't blur before the click lands
                  e.preventDefault();
                  onChange(brand);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                  isHighlight
                    ? "bg-nate-grey-100"
                    : "hover:bg-nate-grey-50"
                }`}
              >
                <span>{brand}</span>
                {isCurrent && <Check className="w-3.5 h-3.5 text-nate-grey-500" />}
              </button>
            );
          })}

          {/* "+ Create" affordance when the typed text is new */}
          {!loading && typed.length > 0 && !exactExists && (
            <div className="border-t border-nate-grey-100 px-3 py-2 text-xs text-nate-grey-600 flex items-center gap-1.5">
              <Plus className="w-3 h-3" />
              Use new brand{" "}
              <span className="font-medium text-nate-grey-900">
                &ldquo;{typed}&rdquo;
              </span>
              <span className="text-nate-grey-400">
                — saved with this product
              </span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

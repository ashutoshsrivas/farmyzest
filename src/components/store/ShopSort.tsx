"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Check } from "lucide-react";

interface SortOption {
  value: string;
  label: string;
}

// Right-hand "Sort by" control for the shop filter bar — the mirror of the
// FILTER button on the left. A small dropdown that rewrites ?sort= while
// preserving every other active filter.
export function ShopSort({ options, current }: { options: SortOption[]; current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") params.delete("sort");
    else params.set("sort", value);
    params.delete("page");
    const s = params.toString();
    router.push(s ? `/shop?${s}` : "/shop");
    setOpen(false);
  }

  const currentLabel = options.find((o) => o.value === current)?.label ?? "Newest";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2 px-4 py-5 text-[11px] font-sans uppercase tracking-[0.15em] text-grey-500 hover:text-grey-800 transition-colors cursor-pointer whitespace-nowrap"
      >
        <ArrowUpDown className="w-3.5 h-3.5" strokeWidth={1.5} />
        <span className="hidden sm:inline">Sort:&nbsp;</span>
        <span className="text-grey-800">{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-grey-300 shadow-lg z-50 py-1">
          {options.map((o) => {
            const active = o.value === current;
            return (
              <button
                key={o.value}
                onClick={() => pick(o.value)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-sans uppercase tracking-[0.1em] text-left transition-colors ${
                  active ? "text-grey-900 bg-grey-100" : "text-grey-600 hover:bg-grey-50"
                }`}
              >
                {o.label}
                {active && <Check className="w-3.5 h-3.5" strokeWidth={2} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

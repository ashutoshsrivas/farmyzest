// src/components/store/SortSelect.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, ArrowUpDown } from "lucide-react";

interface SortOption {
  value: string;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

export function SortSelect({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = SORT_OPTIONS.find((o) => o.value === currentSort) ?? SORT_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sort", value);
    url.searchParams.set("page", "1");
    router.push(url.toString());
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-sans font-medium uppercase tracking-[0.1em] border border-nate-grey-300 bg-white text-nate-grey-700 hover:border-nate-grey-800 hover:text-nate-grey-800 rounded-sm transition-all cursor-pointer min-w-[180px] justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <ArrowUpDown className="w-3 h-3 text-nate-grey-400" strokeWidth={1.5} />
          {activeOption.label}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-nate-grey-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          strokeWidth={1.5}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-[200px] bg-white border border-nate-grey-200 shadow-lg rounded-sm z-50 overflow-hidden"
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              role="option"
              aria-selected={option.value === currentSort}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-2.5 text-xs font-sans flex items-center justify-between transition-colors cursor-pointer ${
                option.value === currentSort
                  ? "bg-nate-grey-800 text-white"
                  : "text-nate-grey-700 hover:bg-nate-grey-100"
              }`}
            >
              <span>{option.label}</span>
              {option.value === currentSort && (
                <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
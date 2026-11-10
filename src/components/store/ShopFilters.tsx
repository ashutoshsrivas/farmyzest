"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { FilterDrawer } from "./FilterDrawer";
import { colorHex } from "@/lib/variant-label";

interface ShopFiltersProps {
  sizes: string[];
  colors: string[];
  brands?: string[];
  categories?: { name: string; slug: string }[];
  priceRange: { min: number; max: number };
  currentCategory?: string;
  currentCategorySlug?: string;
}

export function ShopFilters({ sizes, colors, brands = [], categories = [], priceRange, currentCategory, currentCategorySlug }: ShopFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="shrink-0 flex items-center gap-2 px-4 py-5 text-[11px] font-sans uppercase tracking-[0.15em] text-grey-500 hover:text-grey-800 transition-colors cursor-pointer"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
        Filter
      </button>
      <FilterDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sizes={sizes}
        colors={colors.map((c) => ({ name: c, hex: colorHex(c) }))}
        brands={brands}
        categories={categories}
        priceRange={priceRange}
        currentCategory={currentCategory}
        currentCategorySlug={currentCategorySlug}
      />
    </>
  );
}
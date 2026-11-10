// src/components/store/FilterDrawer.tsx
"use client";

import { X, ChevronDown, Check, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ColorOption {
  name: string;
  hex: string;
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sizes: string[];
  colors: ColorOption[];
  brands: string[];
  categories?: { name: string; slug: string }[];
  priceRange: { min: number; max: number };
  currentCategory?: string;
  currentCategorySlug?: string;
}

type Season = "ALL" | "SUMMER" | "WINTER";

export function FilterDrawer({
  isOpen,
  onClose,
  sizes,
  colors,
  brands,
  categories = [],
  priceRange,
  currentCategory,
}: FilterDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQ, setSearchQ] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season>("ALL");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["category", "size", "color", "price", "season", "brand", "availability"]);
  const [brandSearch, setBrandSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setSearchQ(searchParams.get("q") || "");
    const categoryParam = searchParams.get("category");
    const sizeParam = searchParams.get("size");
    const colorParam = searchParams.get("color");
    const brandParam = searchParams.get("brand");
    const seasonParam = searchParams.get("season");
    const minParam = searchParams.get("minPrice");
    const maxParam = searchParams.get("maxPrice");
    const stockParam = searchParams.get("inStock");

    setSelectedCategories(categoryParam ? categoryParam.split(",") : []);
    setSelectedSizes(sizeParam ? sizeParam.split(",") : []);
    setSelectedColors(colorParam ? colorParam.split(",") : []);
    setSelectedBrands(brandParam ? brandParam.split(",") : []);
    setSelectedSeason((seasonParam as Season) || "ALL");
    setPriceMin(minParam || "");
    setPriceMax(maxParam || "");
    setInStockOnly(stockParam === "true");
  }, [searchParams]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (name: string) => {
    setSelectedColors((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (searchQ.trim()) params.set("q", searchQ.trim());
    else params.delete("q");

    if (selectedCategories.length > 0) params.set("category", selectedCategories.join(","));
    else params.delete("category");

    if (selectedSizes.length > 0) params.set("size", selectedSizes.join(","));
    else params.delete("size");

    if (selectedColors.length > 0) params.set("color", selectedColors.join(","));
    else params.delete("color");

    if (selectedBrands.length > 0) params.set("brand", selectedBrands.join(","));
    else params.delete("brand");

    if (selectedSeason !== "ALL") params.set("season", selectedSeason);
    else params.delete("season");

    if (priceMin) params.set("minPrice", priceMin);
    else params.delete("minPrice");

    if (priceMax) params.set("maxPrice", priceMax);
    else params.delete("maxPrice");

    if (inStockOnly) params.set("inStock", "true");
    else params.delete("inStock");

    params.set("page", "1");
    router.push(`/shop?${params.toString()}`);
    onClose();
  };

  const clearFilters = () => {
    setSearchQ("");
    setSelectedCategories([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedBrands([]);
    setSelectedSeason("ALL");
    setPriceMin("");
    setPriceMax("");
    setInStockOnly(false);
    const params = new URLSearchParams();
    params.set("page", "1");
    router.push(`/shop?${params.toString()}`);
    onClose();
  };

  const activeCount =
    (searchQ.trim() ? 1 : 0) +
    selectedCategories.length +
    selectedSizes.length +
    selectedColors.length +
    selectedBrands.length +
    (selectedSeason !== "ALL" ? 1 : 0) +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  const filteredBrands = brands.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase())
  );

  if (!mounted) return null;

  const drawer = (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[100] transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 bottom-0 w-[360px] max-w-[92vw] bg-white z-[101] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-[68px] border-b border-nate-grey-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-sans uppercase tracking-[0.18em] font-semibold text-nate-grey-800">
              Filters
            </span>
            {activeCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-nate-grey-800 text-white text-[10px] font-sans font-medium flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 cursor-pointer" aria-label="Close filters">
            <X className="w-4 h-4 text-nate-grey-600" strokeWidth={1.5} />
          </button>
        </div>

        {/* Active filter strip */}
        {activeCount > 0 && (
          <div className="px-6 py-3 border-b border-nate-grey-200 shrink-0 bg-nate-grey-100">
            <button
              onClick={clearFilters}
              className="text-[10px] font-sans uppercase tracking-[0.15em] text-nate-grey-500 hover:text-nate-grey-800 cursor-pointer transition-colors"
            >
              Clear all {activeCount} filters
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-0">

          {/* ── Search (combines with every filter below) ── */}
          <div className="pb-5 border-b border-nate-grey-200">
            <label className="block text-[10px] font-sans uppercase tracking-[0.18em] text-nate-grey-500 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Search products…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-nate-grey-300 rounded-sm focus:border-nate-grey-800 focus:outline-none"
              />
            </div>
          </div>

          {/* ── Category ── */}
          {categories.length > 0 && (
            <SectionWrapper
              label="Category"
              expanded={expandedSections.includes("category")}
              onToggle={() => toggleSection("category")}
            >
              <div className="space-y-2">
                {categories.map((c) => {
                  const checked = selectedCategories.includes(c.slug);
                  return (
                    <label key={c.slug} className="flex items-center gap-3 cursor-pointer group">
                      <span
                        className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "border-nate-grey-800 bg-nate-grey-800" : "border-nate-grey-300 group-hover:border-nate-grey-600"
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(c.slug)}
                        className="sr-only"
                      />
                      <span className={`text-xs font-sans tracking-wide ${checked ? "text-nate-grey-800 font-medium" : "text-nate-grey-600"}`}>
                        {c.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </SectionWrapper>
          )}

          {/* ── Size ── */}
          <SectionWrapper
            label={`Size${currentCategory ? ` — ${currentCategory}` : ""}`}
            expanded={expandedSections.includes("size")}
            onToggle={() => toggleSection("size")}
          >
            <div className="flex flex-wrap gap-2">
              {sizes.length > 0 ? (
                sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={`min-w-[48px] px-3 py-2.5 text-[11px] font-sans font-medium uppercase tracking-[0.06em] border transition-all cursor-pointer rounded-sm ${
                      selectedSizes.includes(size)
                        ? "bg-nate-grey-800 text-white border-nate-grey-800"
                        : "bg-white text-nate-grey-700 border-nate-grey-300 hover:border-nate-grey-800"
                    }`}
                  >
                    {size}
                  </button>
                ))
              ) : (
                <p className="text-sm text-nate-grey-400 font-sans">No sizes available</p>
              )}
            </div>
          </SectionWrapper>

          {/* ── Color ── */}
          <SectionWrapper
            label="Color"
            expanded={expandedSections.includes("color")}
            onToggle={() => toggleSection("color")}
          >
            <div className="flex flex-wrap gap-2">
              {colors.length > 0 ? (
                colors.map((color) => {
                  const active = selectedColors.includes(color.name);
                  return (
                    <button
                      key={color.name}
                      onClick={() => toggleColor(color.name)}
                      title={color.name}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-sans capitalize transition-colors cursor-pointer ${
                        active
                          ? "border-nate-grey-800 bg-nate-grey-900 text-white"
                          : "border-nate-grey-300 text-nate-grey-700 hover:border-nate-grey-800"
                      }`}
                    >
                      {active && <Check className="w-3 h-3 shrink-0" strokeWidth={2.5} />}
                      {color.name.toLowerCase()}
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-nate-grey-400 font-sans">No colors available</p>
              )}
            </div>
          </SectionWrapper>

          {/* ── Price Range ── */}
          <SectionWrapper
            label="Price Range"
            expanded={expandedSections.includes("price")}
            onToggle={() => toggleSection("price")}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-sans text-nate-grey-400 uppercase tracking-[0.1em] mb-1.5 block">
                    Min
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nate-grey-400 text-xs font-sans">
                      ₹
                    </span>
                    <input
                      type="text" inputMode="decimal"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder={priceRange.min.toString()}
                      className="w-full pl-6 pr-3 py-2.5 text-xs font-sans border border-nate-grey-300 text-nate-grey-800 rounded-sm focus:border-nate-grey-800 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <span className="text-nate-grey-400 text-xs pt-5 font-sans">–</span>
                <div className="flex-1">
                  <label className="text-[10px] font-sans text-nate-grey-400 uppercase tracking-[0.1em] mb-1.5 block">
                    Max
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nate-grey-400 text-xs font-sans">
                      ₹
                    </span>
                    <input
                      type="text" inputMode="decimal"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder={priceRange.max.toString()}
                      className="w-full pl-6 pr-3 py-2.5 text-xs font-sans border border-nate-grey-300 text-nate-grey-800 rounded-sm focus:border-nate-grey-800 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-nate-grey-400 font-sans">
                Available: ₹{priceRange.min.toLocaleString()} – ₹{priceRange.max.toLocaleString()}
              </p>
            </div>
          </SectionWrapper>

          {/* ── Season ── */}
          <SectionWrapper
            label="Season"
            expanded={expandedSections.includes("season")}
            onToggle={() => toggleSection("season")}
          >
            <div className="space-y-2">
              {(["ALL", "SUMMER", "WINTER"] as Season[]).map((season) => (
                <label
                  key={season}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedSeason === season
                        ? "border-nate-grey-800 bg-nate-grey-800"
                        : "border-nate-grey-400 group-hover:border-nate-grey-600"
                    }`}
                  >
                    {selectedSeason === season && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <input
                    type="radio"
                    name="season"
                    value={season}
                    checked={selectedSeason === season}
                    onChange={() => setSelectedSeason(season)}
                    className="sr-only"
                  />
                  <span
                    className={`text-xs font-sans tracking-wide ${
                      selectedSeason === season
                        ? "text-nate-grey-800 font-medium"
                        : "text-nate-grey-600"
                    }`}
                  >
                    {season === "ALL"
                      ? "All Seasons"
                      : season.charAt(0) + season.slice(1).toLowerCase()}
                  </span>
                </label>
              ))}
            </div>
          </SectionWrapper>

          {/* ── Brand ── */}
          <SectionWrapper
            label="Brand"
            expanded={expandedSections.includes("brand")}
            onToggle={() => toggleSection("brand")}
          >
            {brands.length > 8 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-nate-grey-400" />
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Search brands..."
                  className="w-full pl-7 pr-3 py-2 text-xs font-sans border border-nate-grey-300 text-nate-grey-800 rounded-sm focus:border-nate-grey-800 focus:outline-none transition-colors placeholder:text-nate-grey-400"
                />
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {filteredBrands.length > 0 ? (
                filteredBrands.map((brand) => (
                  <label
                    key={brand}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <span
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                        selectedBrands.includes(brand)
                          ? "border-nate-grey-800 bg-nate-grey-800"
                          : "border-nate-grey-300 group-hover:border-nate-grey-600"
                      }`}
                    >
                      {selectedBrands.includes(brand) && (
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand)}
                      onChange={() => toggleBrand(brand)}
                      className="sr-only"
                    />
                    <span
                      className={`text-xs font-sans ${
                        selectedBrands.includes(brand)
                          ? "text-nate-grey-800 font-medium"
                          : "text-nate-grey-600"
                      }`}
                    >
                      {brand}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-nate-grey-400 font-sans py-1">
                  {brands.length > 0 ? "No matches found" : "No brands available"}
                </p>
              )}
            </div>
          </SectionWrapper>

          {/* ── Availability ── */}
          <SectionWrapper
            label="Availability"
            expanded={expandedSections.includes("availability")}
            onToggle={() => toggleSection("availability")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-sans text-nate-grey-800 font-medium">In Stock Only</p>
                <p className="text-[10px] font-sans text-nate-grey-400 mt-0.5">
                  Hide out-of-stock items
                </p>
              </div>
              <button
                role="switch"
                aria-checked={inStockOnly}
                onClick={() => setInStockOnly((prev) => !prev)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-nate-grey-800 focus-visible:ring-offset-1 ${
                  inStockOnly ? "bg-nate-grey-800" : "bg-nate-grey-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    inStockOnly ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </SectionWrapper>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-nate-grey-200 flex gap-3 shrink-0 bg-white">
          <button
            onClick={clearFilters}
            className="flex-1 px-4 py-3 text-[11px] font-sans font-semibold uppercase tracking-[0.1em] border border-nate-grey-300 text-nate-grey-700 hover:border-nate-grey-800 hover:text-nate-grey-800 rounded-sm transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            onClick={applyFilters}
            className="flex-1 px-4 py-3 text-[11px] font-sans font-semibold uppercase tracking-[0.1em] bg-nate-grey-800 text-white hover:bg-nate-grey-700 rounded-sm transition-colors cursor-pointer"
          >
            View Results
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}

// ── Helper: collapsible section wrapper ──
interface SectionWrapperProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SectionWrapper({ label, expanded, onToggle, children }: SectionWrapperProps) {
  return (
    <div className="border-b border-nate-grey-200 py-5 last:border-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full mb-4 cursor-pointer group"
      >
        <h3 className="text-[10px] font-sans uppercase tracking-[0.18em] text-nate-grey-500 group-hover:text-nate-grey-800 transition-colors">
          {label}
        </h3>
        <ChevronDown
          className={`w-3.5 h-3.5 text-nate-grey-400 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          strokeWidth={1.5}
        />
      </button>
      {expanded && children}
    </div>
  );
}
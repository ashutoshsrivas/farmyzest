"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Plus, Upload, Star, Trash2, ImageIcon } from "lucide-react";
import { BrandCombobox } from "./BrandCombobox";
import { CategoryMultiSelect } from "./CategoryMultiSelect";
import { uploadProductImage } from "@/lib/upload-image";
import {
  TAX_RULE_THRESHOLD,
  TAX_RULE_LOW_PCT,
  TAX_RULE_HIGH_PCT,
  pickTaxSlabForCost,
} from "@/lib/tax-rules";

// Lightweight product-create modal used from the supplier-bill flow (and
// reusable wherever an admin needs to add a not-yet-catalogued product mid-
// task). The full /admin/products/new form has more options (images, SEO,
// material/care); this modal sticks to what's strictly needed to make a
// product valid in the catalog so the admin can keep typing in the bill.
//
// Variant entry is deliberately fast: pick ONE option (default "Size"), type
// all its values at once (M, L, XL …), and a single shared price + colour are
// applied across every generated variant. SKU/barcode are NOT entered here —
// the server assigns sequential SS-N codes (one per variant).
//
// On success the parent receives the freshly created product back (with its
// variants) and decides how to apply it — typically by selecting its first
// variant for the current bill row.

export interface CreatedProduct {
  id: string;
  name: string;
  mrp: number;
  onlinePrice: number | null;
  sellingPrice: number | null;
  costPrice: number | null;
  taxSlab: { percentage: number } | null;
  variants: Array<{
    id: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    colorHex: string | null;
    priceOverride: number | null;
    stock: number;
  }>;
}

interface CategoryLite {
  id: string;
  name: string;
}
interface TaxSlabLite {
  id: string;
  name: string;
  percentage: number;
}

interface QuickCreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (product: CreatedProduct) => void;
  categories: CategoryLite[];
  taxSlabs: TaxSlabLite[];
  /** Optional name to pre-seed (e.g. from the picker's search box). */
  initialName?: string;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Resolve a CSS colour name (black, red, navy, …) to its hex via the browser's
// own colour parser. Returns null for anything the browser doesn't recognise
// (so the admin can fall back to the swatch picker for custom shades).
function nameToHex(name: string): string | null {
  const v = name.trim().toLowerCase();
  if (!v) return null;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return v; // already a hex
  if (typeof document === "undefined") return null;
  // Browser rejects invalid colour strings, leaving the property empty.
  const probe = new Option().style;
  probe.color = v;
  if (!probe.color) return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = v;
  return ctx.fillStyle; // normalised to #rrggbb
}

export function QuickCreateProductModal({
  open,
  onClose,
  onCreated,
  taxSlabs,
  initialName,
}: QuickCreateProductModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  // Selected categories; first is the primary.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [season, setSeason] = useState<"ALL" | "SUMMER" | "WINTER">("ALL");
  const [gender, setGender] = useState<"UNISEX" | "MEN" | "WOMEN">("UNISEX");
  const [costPrice, setCostPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [onlinePrice, setOnlinePrice] = useState("");
  // Online price mirrors MRP until the admin edits it themselves.
  const [onlinePriceTouched, setOnlinePriceTouched] = useState(false);
  const [resellerPrice, setResellerPrice] = useState("");
  const [taxSlabId, setTaxSlabId] = useState("");
  const [makeActive, setMakeActive] = useState(true);

  // ── Streamlined variant entry ──────────────────────────────────────────────
  // Two dimensions → variants are the cross-product (size × colour):
  //   • Option (e.g. "Size") with many values (chips)
  //   • Colours: many {name, hex} entries
  // Leave a dimension empty to skip it. Price below is shared across all.
  const [optionLabel, setOptionLabel] = useState("Size");
  const [optionValues, setOptionValues] = useState<string[]>([]);
  const [valueDraft, setValueDraft] = useState("");
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([]);
  const [colorDraft, setColorDraft] = useState("");
  const [colorHexDraft, setColorHexDraft] = useState("#000000");
  const [variantPrice, setVariantPrice] = useState(""); // shared priceOverride
  const [incentiveType, setIncentiveType] = useState("PERCENT"); // shared incentive
  const [incentiveValue, setIncentiveValue] = useState("1");

  // ── Images ───────────────────────────────────────────────────────────────────
  // Upload a batch of images, mark one as the overall "Main" (primary), and
  // pick which uploaded image represents each colour ("hero per colour"). The
  // colour's hero is tagged with that colour so the PDP swaps to it when the
  // shopper picks the swatch. Identity is by URL so removing/adding images
  // never corrupts the hero/primary references.
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [colorHero, setColorHero] = useState<Record<string, string>>({}); // colour name → image url
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline per-field validation. A field's error shows once it's been touched
  // (blurred) or after a save attempt. `triedSubmit` flips on the first Create
  // click so every outstanding error surfaces at once.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const markTouched = (field: string) =>
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(initialName ?? "");
    setSlug(initialName ? slugify(initialName) : "");
    setSlugTouched(false);
    setCategoryIds([]);
    setBrand("");
    setSeason("ALL");
    setGender("UNISEX");
    setCostPrice("");
    setMrp("");
    setOnlinePrice("");
    setOnlinePriceTouched(false);
    setResellerPrice("");
    setTaxSlabId("");
    setMakeActive(true);
    setOptionLabel("Size");
    setOptionValues([]);
    setValueDraft("");
    setColors([]);
    setColorDraft("");
    setColorHexDraft("#000000");
    setVariantPrice("");
    setImages([]);
    setColorHero({});
    setPrimaryUrl(null);
    setUploading(false);
    setSubmitting(false);
    setError(null);
    setTouched({});
    setTriedSubmit(false);
  }, [open, initialName]);

  // Auto-slug keeps tracking the name unless the admin has edited slug.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Online price mirrors MRP until the admin overrides it.
  useEffect(() => {
    if (!onlinePriceTouched) setOnlinePrice(mrp);
  }, [mrp, onlinePriceTouched]);

  // Auto tax slab from COST: < ₹2,500 → 5%, ≥ ₹2,500 → 18%.
  // Tax is driven by the purchase cost (what we paid), not MRP. We re-apply on
  // every Cost change; manual override sticks until the next Cost edit.
  useEffect(() => {
    if (!costPrice.trim()) return;
    const match = pickTaxSlabForCost(taxSlabs, costPrice);
    if (match && match.id !== taxSlabId) {
      setTaxSlabId(match.id);
    }
    // Intentionally omit taxSlabId from deps — we don't want to re-fire
    // when the admin manually overrides the slab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costPrice, taxSlabs]);

  // ── Option-value chip input ─────────────────────────────────────────────────
  function commitDraft(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setOptionValues((prev) => {
      const seen = new Set(prev.map((v) => v.toLowerCase()));
      const next = [...prev];
      for (const p of parts) {
        if (!seen.has(p.toLowerCase())) {
          next.push(p);
          seen.add(p.toLowerCase());
        }
      }
      return next;
    });
    setValueDraft("");
  }
  function onValueKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft(valueDraft);
    } else if (e.key === "Backspace" && valueDraft === "" && optionValues.length) {
      setOptionValues((prev) => prev.slice(0, -1));
    }
  }
  function removeValue(v: string) {
    setOptionValues((prev) => prev.filter((x) => x !== v));
  }

  // ── Colour chip input ───────────────────────────────────────────────────────
  function addColor() {
    const name = colorDraft.trim();
    if (!name) return;
    setColors((prev) =>
      prev.some((c) => c.name.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, { name, hex: colorHexDraft }]
    );
    setColorDraft("");
    setColorHexDraft("#000000");
  }
  function removeColor(name: string) {
    setColors((prev) => prev.filter((c) => c.name !== name));
    // Drop any hero mapping for a colour that no longer exists.
    setColorHero((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  // ── Image handlers ───────────────────────────────────────────────────────────
  // Compress each picked file to 1080p WebP and upload straight to S3, then
  // append its URL. First uploaded image becomes the default "Main".
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file, slug || name || "product");
        setImages((prev) => (prev.some((i) => i.url === url) ? prev : [...prev, { url }]));
        setPrimaryUrl((prev) => prev ?? url);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((i) => i.url !== url));
    setColorHero((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (v !== url) next[k] = v;
      return next;
    });
    setPrimaryUrl((prev) => {
      if (prev !== url) return prev;
      const remaining = images.filter((i) => i.url !== url);
      return remaining[0]?.url ?? null;
    });
  }

  function setHero(colorName: string, url: string) {
    // Toggle: clicking the current hero again clears it.
    setColorHero((prev) =>
      prev[colorName] === url
        ? (() => {
            const next = { ...prev };
            delete next[colorName];
            return next;
          })()
        : { ...prev, [colorName]: url }
    );
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  // For a fast purchase/stock-in entry, only the five essentials are mandatory:
  // Product Name, Cost, MRP, Brand, and Category. Everything else is optional —
  // slug auto-derives from the name, online price falls back to MRP, tax/variant
  // options/images can be filled in later from the full product editor. Any
  // still-entered non-positive number is flagged so bad data can't slip through.
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const pos = (s: string) => {
      const n = parseFloat(s);
      return isFinite(n) && n > 0;
    };

    if (!name.trim()) e.name = "Product name is required.";
    if (categoryIds.length === 0) e.category = "Pick at least one category.";
    if (!brand.trim()) e.brand = "Brand is required.";
    if (!costPrice.trim()) e.cost = "Cost is required.";
    else if (!pos(costPrice)) e.cost = "Enter a cost greater than 0.";
    if (!mrp.trim()) e.mrp = "MRP is required.";
    else if (!pos(mrp)) e.mrp = "Enter an MRP greater than 0.";
    // Optional, but if the user DID type one it must be a valid positive number.
    if (onlinePrice.trim() && !pos(onlinePrice)) e.onlinePrice = "Enter an online price greater than 0.";
    return e;
  }, [name, categoryIds, brand, costPrice, mrp, onlinePrice]);

  const canSubmit = !submitting && Object.keys(errors).length === 0;
  // Whether a given field's error should be visible right now.
  const showErr = (field: string) => (triedSubmit || touched[field]) && !!errors[field];

  async function submit() {
    if (submitting) return;
    if (Object.keys(errors).length > 0) {
      // Surface every outstanding error and don't save.
      setTriedSubmit(true);
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Fold any half-typed value in the draft box into the list.
    const values = (() => {
      const base = [...optionValues];
      const draftParts = valueDraft
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const seen = new Set(base.map((v) => v.toLowerCase()));
      for (const p of draftParts) {
        if (!seen.has(p.toLowerCase())) {
          base.push(p);
          seen.add(p.toLowerCase());
        }
      }
      return base;
    })();

    // Fold any half-typed colour in the draft box into the list.
    const colorList = (() => {
      const base = [...colors];
      const name = colorDraft.trim();
      if (name && !base.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        base.push({ name, hex: colorHexDraft });
      }
      return base;
    })();

    // Variants are the cross-product of sizes × colours. Empty dimensions fall
    // back to a single null so a one-variant product still works. SKU + barcode
    // are assigned server-side, so we don't send them.
    const sharedPrice = variantPrice ? parseFloat(variantPrice) : undefined;
    const sizeDims = values.length > 0 ? values : [null];
    const colorDims = colorList.length > 0 ? colorList : [null];
    const builtVariants = sizeDims.flatMap((size) =>
      colorDims.map((c) => ({
        size: size ?? undefined,
        color: c?.name ?? undefined,
        colorHex: c ? c.hex : undefined,
        priceOverride: sharedPrice,
        stock: 0,
        incentiveType: incentiveType === "AMOUNT" ? "AMOUNT" : "PERCENT",
        incentiveValue: incentiveValue ? parseFloat(incentiveValue) : 1,
      }))
    );

    // Build the image rows. Each colour's chosen hero is tagged with that
    // colour (drives the PDP swatch→image swap). Remaining images are added as
    // untagged gallery shots. Exactly one row is flagged primary (the Main).
    const heroUrls = new Set(Object.values(colorHero));
    const imageRows: { url: string; color?: string }[] = [];
    for (const c of colorList) {
      const url = colorHero[c.name];
      if (url) imageRows.push({ url, color: c.name });
    }
    for (const img of images) {
      if (!heroUrls.has(img.url)) imageRows.push({ url: img.url });
    }
    let primaryDone = false;
    const imagesPayload = imageRows.map((r) => {
      const isPrimary = !primaryDone && r.url === primaryUrl;
      if (isPrimary) primaryDone = true;
      return { url: r.url, alt: name.trim(), color: r.color, isPrimary };
    });
    if (imagesPayload.length && !primaryDone) imagesPayload[0]!.isPrimary = true;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      // Optional now — server derives a unique slug from the name when omitted.
      slug: slug.trim() || undefined,
      categoryId: categoryIds[0],
      categoryIds,
      mrp: parseFloat(mrp),
      // Optional now — server defaults the online price to MRP when omitted.
      onlinePrice: onlinePrice.trim() ? parseFloat(onlinePrice) : undefined,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      resellerPrice: resellerPrice ? parseFloat(resellerPrice) : undefined,
      taxSlabId: taxSlabId || undefined,
      brand: brand.trim() || undefined,
      season,
      gender,
      status: makeActive ? "ACTIVE" : "DRAFT",
      variants: builtVariants,
      images: imagesPayload.length ? imagesPayload : undefined,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Create failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      // Normalize the server response into the shape the parent expects.
      const created: CreatedProduct = {
        id: data.id,
        name: data.name,
        mrp: data.mrp,
        onlinePrice: data.onlinePrice ?? null,
        sellingPrice: data.sellingPrice ?? null,
        costPrice: data.costPrice ?? null,
        taxSlab:
          data.taxSlab && typeof data.taxSlab.percentage === "number"
            ? { percentage: data.taxSlab.percentage }
            : taxSlabId
            ? {
                percentage:
                  taxSlabs.find((t) => t.id === taxSlabId)?.percentage ?? 0,
              }
            : null,
        variants: (data.variants ?? []).map((v: {
          id: string;
          sku: string;
          barcode: string;
          size: string | null;
          color: string | null;
          colorHex: string | null;
          priceOverride: number | null;
          stock: number;
        }) => ({
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          priceOverride: v.priceOverride,
          stock: v.stock,
        })),
      };
      onCreated(created);
      onClose();
    } catch {
      setError("Network error — please retry.");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const variantCount = (optionValues.length || 1) * (colors.length || 1);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      /* Deliberately NO backdrop-click-to-close — a stray click outside must not
         wipe a half-filled product form. Close only via the X or Cancel. */
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
          <div>
            <h2 className="text-lg font-medium text-nate-grey-900">
              Add new product
            </h2>
            <p className="text-xs text-nate-grey-500 mt-0.5">
              Quick-create from this bill. You can fine-tune images, SEO, and
              care instructions in <strong>Admin → Products</strong> later.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-nate-grey-400 hover:text-nate-grey-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Product name *" error={showErr("name") && errors.name}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="e.g. Classic Cotton T-Shirt"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                  showErr("name") ? "border-red-400" : "border-nate-grey-200"
                }`}
              />
            </Field>
            <Field label="Slug (auto from name)" error={showErr("slug") && errors.slug}>
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                onBlur={() => markTouched("slug")}
                placeholder="classic-cotton-tshirt"
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                  showErr("slug") ? "border-red-400" : "border-nate-grey-200"
                }`}
              />
            </Field>
            <div className="md:col-span-2">
              <CategoryMultiSelect value={categoryIds} onChange={setCategoryIds} />
              {showErr("category") && (
                <span className="block text-[11px] text-red-600 mt-1">{errors.category}</span>
              )}
            </div>
            <Field label="Brand *" error={showErr("brand") && errors.brand}>
              {/* Typeahead suggesting existing Product.brand values. Typing
                  a new brand is allowed — it becomes a "new" brand the
                  moment this product saves, because /api/admin/brands
                  returns distinct values from the catalog. Brand isn't
                  surfaced on the storefront UI but is included in search. */}
              <BrandCombobox value={brand} onChange={setBrand} />
            </Field>
            <Field label="Season">
              <select
                value={season}
                onChange={(e) =>
                  setSeason(e.target.value as "ALL" | "SUMMER" | "WINTER")
                }
                className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              >
                <option value="ALL">All seasons</option>
                <option value="SUMMER">Summer</option>
                <option value="WINTER">Winter</option>
              </select>
            </Field>
            <Field label="Audience">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "UNISEX" | "MEN" | "WOMEN")}
                className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              >
                <option value="UNISEX">Unisex</option>
                <option value="MEN">Men</option>
                <option value="WOMEN">Women</option>
              </select>
            </Field>
            <Field label="Visibility">
              <label className="flex items-center gap-2 text-sm h-10">
                <input
                  type="checkbox"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="h-4 w-4 accent-black"
                />
                Active (show in store + POS)
              </label>
            </Field>
          </div>

          {/* Pricing — Cost first (it drives tax), then MRP, Online Price, Tax. */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-nate-grey-500 mb-2">
              Pricing
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Cost * (₹)" error={showErr("cost") && errors.cost}>
                <input
                  type="text" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  onBlur={() => markTouched("cost")}
                  placeholder="e.g. 600"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                    showErr("cost") ? "border-red-400" : "border-nate-grey-200"
                  }`}
                />
              </Field>
              <Field label="MRP * (₹)" error={showErr("mrp") && errors.mrp}>
                <input
                  type="text" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  onBlur={() => markTouched("mrp")}
                  placeholder="1499"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                    showErr("mrp") ? "border-red-400" : "border-nate-grey-200"
                  }`}
                />
              </Field>
              <Field label="Online Price (₹, defaults to MRP)" error={showErr("onlinePrice") && errors.onlinePrice}>
                <input
                  type="text" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={onlinePrice}
                  onChange={(e) => {
                    setOnlinePriceTouched(true);
                    setOnlinePrice(e.target.value);
                  }}
                  onBlur={() => markTouched("onlinePrice")}
                  placeholder="defaults to MRP"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                    showErr("onlinePrice") ? "border-red-400" : "border-nate-grey-200"
                  }`}
                />
              </Field>
              <Field label="Reseller Price (₹, optional)">
                <input
                  type="text" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={resellerPrice}
                  onChange={(e) => setResellerPrice(e.target.value)}
                  placeholder="for resellers (optional)"
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                />
              </Field>
              <Field label="Tax slab (auto)" error={showErr("taxSlab") && errors.taxSlab}>
                <select
                  value={taxSlabId}
                  onChange={(e) => { setTaxSlabId(e.target.value); markTouched("taxSlab"); }}
                  onBlur={() => markTouched("taxSlab")}
                  className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                    showErr("taxSlab") ? "border-red-400" : "border-nate-grey-200"
                  }`}
                >
                  <option value="">None</option>
                  {taxSlabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.percentage}%)
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-xs text-nate-grey-400 mt-1">
              Cost is the purchase price <em>pre-GST</em>; it drives profit and
              stock-value reports.
              {" "}Tax slab is picked automatically from <strong>Cost</strong>:
              {" "}Cost &lt; ₹{TAX_RULE_THRESHOLD.toLocaleString("en-IN")}
              {" "}→ {TAX_RULE_LOW_PCT}%; otherwise → {TAX_RULE_HIGH_PCT}%.
              {" "}Override manually if needed — editing Cost re-applies the rule.
            </p>
          </div>

          {/* Variants — one option, many values, shared price + colour. */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-nate-grey-500 mb-2">
              Variants
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Option" error={showErr("optionLabel") && errors.optionLabel}>
                <input
                  value={optionLabel}
                  onChange={(e) => setOptionLabel(e.target.value)}
                  onBlur={() => markTouched("optionLabel")}
                  placeholder="Size"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none ${
                    showErr("optionLabel") ? "border-red-400" : "border-nate-grey-200"
                  }`}
                />
              </Field>
              <div className="md:col-span-2">
                <span className="block text-xs text-nate-grey-600 mb-1">
                  {optionLabel || "Option"} values
                </span>
                <div className={`flex flex-wrap items-center gap-1.5 border rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent ${
                  showErr("optionValues") ? "border-red-400" : "border-nate-grey-200"
                }`}>
                  {optionValues.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 bg-nate-grey-100 text-nate-grey-800 rounded px-2 py-0.5 text-xs"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => removeValue(v)}
                        className="text-nate-grey-400 hover:text-red-600"
                        aria-label={`Remove ${v}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={valueDraft}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(",")) commitDraft(val);
                      else setValueDraft(val);
                    }}
                    onKeyDown={onValueKeyDown}
                    onBlur={() => {
                      markTouched("optionValues");
                      if (valueDraft.trim()) commitDraft(valueDraft);
                    }}
                    placeholder={
                      optionValues.length ? "Add more…" : "M, L, XL — Enter to add"
                    }
                    className="flex-1 min-w-[120px] text-sm outline-none py-0.5"
                  />
                </div>
                {showErr("optionValues") && (
                  <span className="block text-[11px] text-red-600 mt-1">{errors.optionValues}</span>
                )}
              </div>
            </div>

            {/* Colours — add as many as needed; each becomes a variant per size. */}
            <div className="mt-3">
              <span className="block text-xs text-nate-grey-600 mb-1">
                Colours (optional)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorHexDraft}
                  onChange={(e) => setColorHexDraft(e.target.value)}
                  className="h-[38px] w-10 border border-nate-grey-200 rounded-lg cursor-pointer shrink-0"
                  aria-label="Colour swatch"
                />
                <input
                  value={colorDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setColorDraft(v);
                    // Auto-match the swatch to the typed colour name (red → red).
                    const hex = nameToHex(v);
                    if (hex) setColorHexDraft(hex);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addColor();
                    }
                  }}
                  placeholder="Type a colour name e.g. Black — then Add"
                  className="flex-1 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={addColor}
                  disabled={!colorDraft.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium bg-nate-grey-100 text-nate-grey-700 rounded-lg hover:bg-nate-grey-200 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {colors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {colors.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 bg-nate-grey-100 text-nate-grey-800 rounded px-2 py-1 text-xs"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-nate-grey-300 shrink-0"
                        style={{ background: c.hex }}
                      />
                      {c.name}
                      <button
                        type="button"
                        onClick={() => removeColor(c.name)}
                        className="text-nate-grey-400 hover:text-red-600"
                        aria-label={`Remove ${c.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Field label="Price / variant (₹, optional)">
                <input
                  type="text" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={variantPrice}
                  onChange={(e) => setVariantPrice(e.target.value)}
                  placeholder="defaults to online price"
                  className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                />
              </Field>
              <Field label="Incentive / variant (default 1%)">
                <div className="flex items-center gap-2">
                  <select
                    value={incentiveType}
                    onChange={(e) => setIncentiveType(e.target.value)}
                    className="border border-nate-grey-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-accent outline-none"
                  >
                    <option value="PERCENT">%</option>
                    <option value="AMOUNT">₹</option>
                  </select>
                  <input
                    type="text" inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={incentiveValue}
                    onChange={(e) => setIncentiveValue(e.target.value)}
                    placeholder="1"
                    className="flex-1 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                  />
                </div>
              </Field>
            </div>

            <p className="text-xs text-nate-grey-400 mt-2">
              This creates <strong>{variantCount}</strong> variant
              {variantCount === 1 ? "" : "s"}
              {optionValues.length && colors.length
                ? ` (${optionValues.length} ${(optionLabel || "option").toLowerCase()} × ${colors.length} colour${colors.length === 1 ? "" : "s"})`
                : optionValues.length
                ? ` (one per ${(optionLabel || "option").toLowerCase()})`
                : colors.length
                ? " (one per colour)"
                : " (no options selected)"}
              , each sharing the price above. Each gets an automatic sequential
              code (SS-1, SS-2 …) and a matching barcode. Stock starts at 0 — the
              bill's quantity is what adds inventory.
            </p>
          </div>

          {/* Images — upload a batch, mark the Main, pick a hero per colour. */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-nate-grey-500 mb-2">
              Images
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => !uploading && fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !uploading && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (!uploading) handleFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center justify-center gap-1.5 w-full px-4 py-6 text-sm font-medium border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragActive
                  ? "border-nate-grey-900 bg-nate-grey-50"
                  : "border-nate-grey-300 text-nate-grey-700 hover:border-nate-grey-900 hover:bg-nate-grey-50"
              } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span>{uploading ? "Uploading…" : dragActive ? "Drop images here" : "Upload images or drag & drop"}</span>
              <span className="text-xs font-normal text-nate-grey-400 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Required — compressed to 1080p WebP
              </span>
            </div>
            {showErr("images") && (
              <span className="block text-[11px] text-red-600 mt-1">{errors.images}</span>
            )}

            {images.length === 0 ? null : (
              <>
                {/* Uploaded thumbnails — star sets the overall Main image. */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                  {images.map((img) => {
                    const isMain = primaryUrl === img.url;
                    return (
                      <div
                        key={img.url}
                        className={`relative aspect-square rounded-lg overflow-hidden border ${
                          isMain ? "border-nate-grey-900 ring-2 ring-nate-grey-900" : "border-nate-grey-200"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPrimaryUrl(img.url)}
                          title={isMain ? "Main image" : "Set as main image"}
                          className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center ${
                            isMain ? "bg-nate-grey-900 text-white" : "bg-white/90 text-nate-grey-500 hover:text-nate-grey-900"
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isMain ? "fill-white" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.url)}
                          title="Remove"
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-nate-grey-500 hover:text-red-600 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-nate-grey-400 mt-1.5">
                  <Star className="w-3 h-3 inline -mt-0.5" /> marks the Main
                  image shown on listings.
                </p>

                {/* Hero per colour — click a thumb to assign it to that colour. */}
                {colors.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    <span className="block text-xs text-nate-grey-600">
                      Hero image per colour
                      <span className="text-nate-grey-400">
                        {" "}— shown when a shopper picks that colour
                      </span>
                    </span>
                    {colors.map((c) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 w-28 shrink-0 text-xs text-nate-grey-700">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-nate-grey-300 shrink-0"
                            style={{ background: c.hex }}
                          />
                          {c.name}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {images.map((img) => {
                            const chosen = colorHero[c.name] === img.url;
                            return (
                              <button
                                key={img.url}
                                type="button"
                                onClick={() => setHero(c.name, img.url)}
                                className={`relative w-12 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                                  chosen ? "border-nate-grey-900" : "border-transparent hover:border-nate-grey-300"
                                }`}
                                title={chosen ? "Hero for this colour" : "Set as hero for this colour"}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-nate-grey-100 bg-nate-grey-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-nate-grey-700 hover:text-black disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            aria-disabled={!canSubmit}
            title={!canSubmit ? "Fill in all required fields to continue" : undefined}
            className={`inline-flex items-center gap-2 px-5 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 ${
              !canSubmit ? "opacity-60" : ""
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Creating…" : "Create + use in bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string | false;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-nate-grey-600 mb-1">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-red-600 mt-1">{error}</span>}
    </label>
  );
}

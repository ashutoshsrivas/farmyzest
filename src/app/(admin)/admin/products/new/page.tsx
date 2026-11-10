"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { uploadProductImage } from "@/lib/upload-image";
import { CategoryMultiSelect } from "@/components/admin/CategoryMultiSelect";
import { colorHex } from "@/lib/variant-label";
import {
  TAX_RULE_THRESHOLD,
  TAX_RULE_LOW_PCT,
  TAX_RULE_HIGH_PCT,
  pickTaxSlabForMrp,
} from "@/lib/tax-rules";

interface TaxSlab {
  id: string;
  name: string;
  percentage: number;
}

interface VariantRow {
  id: string;
  size: string;
  color: string;
  colorHex: string;
  priceOverride: string;
  stock: string;
  incentiveType: string; // "PERCENT" | "AMOUNT"
  incentiveValue: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
  const [brandNames, setBrandNames] = useState<string[]>([]);
  // Selected categories; the first is the primary (canonical) category.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    mrp: "",
    salePrice: "",
    sellingPrice: "",
    onlinePrice: "",
    costPrice: "",
    maxDiscountPct: "",
    resellerPrice: "",
    taxSlabId: "",
    brand: "",
    season: "ALL",
    gender: "UNISEX",
    status: "DRAFT",
    showOnWebsite: true,
    material: "",
    careInstructions: "",
    tags: "",
  });

  const [images, setImages] = useState<{ url: string; alt: string; color: string; isPrimary: boolean }[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([
    { id: "1", size: "", color: "", colorHex: "#000000", priceOverride: "", stock: "0", incentiveType: "PERCENT", incentiveValue: "1" },
  ]);

  useEffect(() => {
    // Categories are handled by <CategoryMultiSelect/> (which fetches its own).
    fetch("/api/tax-slabs")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTaxSlabs(data);
      });
    // Brand suggestions for the autocomplete datalist.
    fetch("/api/admin/brands")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.brands)) setBrandNames(d.brands.map((b: { name: string }) => b.name));
      })
      .catch(() => {});
  }, []);

  // Auto-pick tax slab from MRP. Rule: MRP < ₹2,500 → 5%, else 18%. The same
  // rule fires in the supplier-bill quick-create modal so behaviour stays
  // consistent across product entry points.
  useEffect(() => {
    if (!form.mrp.trim() || taxSlabs.length === 0) return;
    const match = pickTaxSlabForMrp(taxSlabs, form.mrp);
    if (match && match.id !== form.taxSlabId) {
      setForm((f) => ({ ...f, taxSlabId: match.id }));
    }
    // Intentionally omit form.taxSlabId — manual override should stick until
    // MRP is edited again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mrp, taxSlabs]);

  const addVariant = () => {
    setVariants([
      ...variants,
      { id: Date.now().toString(), size: "", color: "", colorHex: "#000000", priceOverride: "", stock: "0", incentiveType: "PERCENT", incentiveValue: "1" },
    ]);
  };

  const removeVariant = (id: string) => {
    if (variants.length > 1) setVariants(variants.filter((v) => v.id !== id));
  };

  const updateVariant = (id: string, field: keyof VariantRow, value: string) => {
    setVariants(
      variants.map((v) => {
        if (v.id !== id) return v;
        // Typing a colour name auto-updates the swatch from a known palette.
        if (field === "color") {
          return { ...v, color: value, colorHex: value.trim() ? colorHex(value) : "#000000" };
        }
        return { ...v, [field]: value };
      })
    );
  };

  // Existing colour names across the catalog — for the variant colour datalist.
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/variant-colors")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.colors && setColorOptions(d.colors))
      .catch(() => {});
  }, []);

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Compress each picked file to 1080p WebP and upload straight to S3, then
  // append the returned URL to the image list.
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file, form.slug || form.name || "product");
        setImages((prev) => [
          ...prev,
          { url, alt: form.name || "Product image", color: "", isPrimary: prev.length === 0 },
        ]);
      }
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, isPrimary: i === 0 })));
  };

  const setImageColor = (index: number, color: string) => {
    setImages(images.map((img, i) => (i === index ? { ...img, color } : img)));
  };

  // Distinct colours entered across the variant rows — used to populate the
  // per-image colour dropdown so admins tag images consistently.
  const variantColors = Array.from(
    new Set(variants.map((v) => v.color.trim()).filter(Boolean))
  );

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryIds.length === 0) {
      toast.error("Pick at least one category");
      return;
    }
    setLoading(true);

    try {
      const payload = {
        ...form,
        categoryIds,
        categoryId: categoryIds[0],
        mrp: parseFloat(form.mrp),
        salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
        sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
        onlinePrice: parseFloat(form.onlinePrice),
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        maxDiscountPct: form.maxDiscountPct === "" ? null : parseFloat(form.maxDiscountPct),
        resellerPrice: form.resellerPrice === "" ? null : parseFloat(form.resellerPrice),
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        images: images.map((img, i) => ({ ...img, isPrimary: i === 0 })),
        // SKU + barcode are assigned server-side (sequential SS-N), so we only
        // send variant attributes. Skip fully-empty extra rows.
        variants: variants
          .filter((v, i) => i === 0 || v.size.trim() || v.color.trim() || v.priceOverride.trim() || parseInt(v.stock) > 0)
          .map((v) => ({
            size: v.size || undefined,
            color: v.color || undefined,
            colorHex: v.color.trim() ? v.colorHex || undefined : undefined,
            priceOverride: v.priceOverride ? parseFloat(v.priceOverride) : undefined,
            stock: parseInt(v.stock) || 0,
            incentiveType: v.incentiveType === "AMOUNT" ? "AMOUNT" : "PERCENT",
            incentiveValue: v.incentiveValue ? parseFloat(v.incentiveValue) : 1,
          })),
      };

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product");

      toast.success("Product created!");
      router.push("/admin/products");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Add New Product</h1>
        <button onClick={() => router.back()} className="text-sm text-nate-grey-500 hover:text-nate-grey-700">
          ← Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-medium text-nate-grey-800">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Product Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) });
                }}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="e.g. Classic Cotton T-Shirt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Slug *</label>
              <input
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="classic-cotton-tshirt"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                rows={3}
                placeholder="Product description..."
              />
            </div>
            <div>
              <CategoryMultiSelect value={categoryIds} onChange={setCategoryIds} />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Season</label>
              <select
                value={form.season}
                onChange={(e) => setForm({ ...form, season: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
              >
                <option value="ALL">All Seasons</option>
                <option value="SUMMER">Summer</option>
                <option value="WINTER">Winter</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Audience</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
              >
                <option value="UNISEX">Unisex</option>
                <option value="MEN">Men</option>
                <option value="WOMEN">Women</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                list="brand-suggestions"
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="Brand name"
              />
              <datalist id="brand-suggestions">
                {brandNames.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            {/* Website visibility — POS always keeps the product regardless. */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, showOnWebsite: !form.showOnWebsite })}
                  className={`inline-flex items-center w-11 h-6 rounded-full px-0.5 transition-colors ${
                    form.showOnWebsite ? "bg-nate-grey-900 justify-end" : "bg-nate-grey-300 justify-start"
                  }`}
                  aria-pressed={form.showOnWebsite}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </button>
                <span className="text-sm text-nate-grey-700">
                  Show on website
                  <span className="block text-xs text-nate-grey-400">
                    Off = hidden from the online store but still sellable in POS.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-medium text-nate-grey-800">Pricing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                Cost Price
                <span className="ml-1 text-xs text-nate-grey-400 font-normal">(pre-GST, drives margin)</span>
              </label>
              <input
                type="text" inputMode="decimal"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                Max discount %
                <span className="ml-1 text-xs text-nate-grey-400 font-normal">(0 = no extra discount)</span>
              </label>
              <input
                type="text" inputMode="decimal"
                min={0}
                max={100}
                value={form.maxDiscountPct}
                onChange={(e) => setForm({ ...form, maxDiscountPct: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="No cap"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                Reseller Price
                <span className="ml-1 text-xs text-nate-grey-400 font-normal">(shown to resellers)</span>
              </label>
              <input
                type="text" inputMode="decimal"
                step="0.01"
                value={form.resellerPrice}
                onChange={(e) => setForm({ ...form, resellerPrice: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="No reseller price"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">MRP *</label>
              <input
                required
                type="text" inputMode="decimal"
                step="0.01"
                value={form.mrp}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="1499"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Sale Price</label>
              <input
                type="text" inputMode="decimal"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="999"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Online Price *</label>
              <input
                required
                type="text" inputMode="decimal"
                step="0.01"
                value={form.onlinePrice}
                onChange={(e) => setForm({ ...form, onlinePrice: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="1299"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">
                Tax Slab <span className="text-nate-grey-400 font-normal">(auto from MRP)</span>
              </label>
              <select
                value={form.taxSlabId}
                onChange={(e) => setForm({ ...form, taxSlabId: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
              >
                <option value="">None</option>
                {taxSlabs.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          {(() => {
            const cost = parseFloat(form.costPrice) || 0;
            const taxPct = taxSlabs.find((t) => t.id === form.taxSlabId)?.percentage ?? 0;
            const landing = cost * (1 + taxPct / 100);
            if (cost <= 0) return null;
            return (
              <div className="flex items-center gap-2 text-sm bg-nate-grey-50 border border-nate-grey-200 rounded-lg px-4 py-2.5">
                <span className="text-nate-grey-600">Landing cost (cost + {taxPct}% GST):</span>
                <span className="font-semibold text-nate-grey-900">₹{landing.toFixed(2)}</span>
              </div>
            );
          })()}
          <p className="text-xs text-nate-grey-500 -mt-1">
            Tax slab is picked from MRP: &lt; ₹{TAX_RULE_THRESHOLD.toLocaleString("en-IN")} → {TAX_RULE_LOW_PCT}%, otherwise → {TAX_RULE_HIGH_PCT}%. Manual override sticks until MRP is edited again.
          </p>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-medium text-nate-grey-800">Product Images</h2>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (!uploading) handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${
              dragActive ? "border-nate-grey-900 bg-nate-grey-50" : "border-nate-grey-300 hover:bg-nate-grey-50"
            } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 text-nate-grey-500 animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-nate-grey-400" />
            )}
            <span className="text-sm text-nate-grey-600">
              {uploading ? "Uploading…" : dragActive ? "Drop images here" : "Click to upload or drag & drop images"}
            </span>
            <span className="text-xs text-nate-grey-400">
              Auto-compressed to 1080p WebP · uploaded to S3
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img.url}
                    alt={img.alt}
                    className="w-full aspect-square object-cover rounded-lg border-2 border-nate-grey-200"
                  />
                  {img.isPrimary && (
                    <span className="absolute top-2 left-2 bg-accent text-nate-grey-800 text-xs px-2 py-0.5 rounded-full font-medium">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {/* Per-image colour tag → drives the PDP colour→image swap.
                      Options come from the variant colours entered below. */}
                  <select
                    value={img.color}
                    onChange={(e) => setImageColor(i, e.target.value)}
                    className="mt-1.5 w-full text-xs border border-nate-grey-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                    title="Tag this image with a colour"
                  >
                    <option value="">Any colour</option>
                    {variantColors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          {images.length > 0 && variantColors.length > 0 && (
            <p className="text-xs text-nate-grey-400">
              Tag an image with a colour so picking that colour on the product
              page shows it. Untagged images show for every colour.
            </p>
          )}
        </div>

        {/* Variants */}
        <div className="bg-white rounded-xl p-6 space-y-4">
          {/* Colour autocomplete — suggests colours already used across products. */}
          <datalist id="variant-color-options">
            {colorOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-nate-grey-800">Variants</h2>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-2 px-4 py-2 bg-nate-grey-100 text-nate-grey-700 rounded-lg text-sm font-medium hover:bg-nate-grey-200"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-nate-grey-500 border-b border-nate-grey-200">
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3 pr-4">Color</th>
                  <th className="pb-3 pr-4">Swatch</th>
                  <th className="pb-3 pr-4">Price Override</th>
                  <th className="pb-3 pr-4">Stock</th>
                  <th className="pb-3 pr-4">Incentive</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-nate-grey-100">
                    <td className="py-3 pr-4">
                      <input
                        value={v.size}
                        onChange={(e) => updateVariant(v.id, "size", e.target.value)}
                        className="border border-nate-grey-200 rounded px-2 py-2 w-16 focus:ring-1 focus:ring-accent"
                        placeholder="M"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        value={v.color}
                        onChange={(e) => updateVariant(v.id, "color", e.target.value)}
                        list="variant-color-options"
                        className="border border-nate-grey-200 rounded px-2 py-2 w-20 focus:ring-1 focus:ring-accent"
                        placeholder="Black"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="color"
                        value={v.colorHex || "#000000"}
                        onChange={(e) => updateVariant(v.id, "colorHex", e.target.value)}
                        disabled={!v.color.trim()}
                        title={v.color.trim() ? "Pick the colour swatch" : "Enter a colour name first"}
                        className="border border-nate-grey-200 rounded w-12 h-9 p-0.5 cursor-pointer disabled:opacity-40"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="text" inputMode="decimal"
                        value={v.priceOverride}
                        onChange={(e) => updateVariant(v.id, "priceOverride", e.target.value)}
                        className="border border-nate-grey-200 rounded px-2 py-2 w-20 focus:ring-1 focus:ring-accent"
                        placeholder="1299"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="text" inputMode="decimal"
                        value={v.stock}
                        onChange={(e) => updateVariant(v.id, "stock", e.target.value)}
                        className="border border-nate-grey-200 rounded px-2 py-2 w-20 focus:ring-1 focus:ring-accent"
                        placeholder="10"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        <select
                          value={v.incentiveType}
                          onChange={(e) => updateVariant(v.id, "incentiveType", e.target.value)}
                          className="border border-nate-grey-200 rounded px-1.5 py-2 bg-white focus:ring-1 focus:ring-accent"
                          title="Incentive type"
                        >
                          <option value="PERCENT">%</option>
                          <option value="AMOUNT">₹</option>
                        </select>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={v.incentiveValue}
                          onChange={(e) => updateVariant(v.id, "incentiveValue", e.target.value)}
                          className="border border-nate-grey-200 rounded px-2 py-2 w-16 focus:ring-1 focus:ring-accent"
                          placeholder="1"
                        />
                      </div>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => removeVariant(v.id)}
                        className="text-nate-grey-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Extra info */}
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-medium text-nate-grey-800">Additional Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Material</label>
              <input
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="100% Cotton"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Tags (comma-separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                placeholder="premium, cotton, summer"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Care Instructions</label>
              <textarea
                value={form.careInstructions}
                onChange={(e) => setForm({ ...form, careInstructions: e.target.value })}
                className="w-full border border-nate-grey-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                rows={2}
                placeholder="Machine wash cold..."
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-nate-grey-800 text-white py-4 rounded-lg font-medium hover:bg-nate-grey-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </form>
    </div>
  );
}
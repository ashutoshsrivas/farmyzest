"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2, AlertTriangle, Upload, Loader2, Star, GripVertical } from "lucide-react";
import { uploadProductImage } from "@/lib/upload-image";
import { CategoryMultiSelect } from "@/components/admin/CategoryMultiSelect";
import { ProductBarcodeButton } from "./_components/ProductBarcodeButton";
import { ProductLedger } from "./_components/ProductLedger";
import { colorHex } from "@/lib/variant-label";

interface TaxSlab {
  id: string;
  name: string;
  percentage: number;
}

interface ImageRow {
  url: string;
  alt: string;
  color: string;
  isPrimary: boolean;
}

interface VariantRow {
  id: string;
  // Read-only display of the server-assigned code (SS-N). Empty for new rows
  // until they're saved. Not editable, not sent — the server owns codes.
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  priceOverride: string;
  mrp: string;
  costPrice: string; // "PR" — purchase/cost rate
  stock: string;
  incentiveType: string; // "PERCENT" | "AMOUNT"
  incentiveValue: string;
}

interface ProductData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  mrp: number;
  salePrice: number | null;
  sellingPrice: number | null;
  onlinePrice: number | null;
  costPrice: number | null;
  maxDiscountPct: number | null;
  resellerPrice: number | null;
  taxSlabId: string | null;
  brand: string | null;
  season: string;
  gender: string;
  status: string;
  material: string | null;
  careInstructions: string | null;
  tags: string[];
  images: ImageRow[];
  variants: Array<{
    id: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    colorHex: string | null;
    priceOverride: number | null;
    mrp: number | null;
    costPrice: number | null;
    stock: number;
  }>;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(true);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
  const [brandNames, setBrandNames] = useState<string[]>([]);
  // Selected categories; first is the primary.
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

  const [images, setImages] = useState<ImageRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  // Drag-and-drop reordering of the image grid.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    // Fetch product
    fetch(`/api/admin/products?id=${productId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch product");
        return r.json();
      })
      .then((data) => {
        const p = Array.isArray(data.products)
          ? data.products.find((pr: any) => pr.id === productId)
          : data;
        if (!p) {
          toast.error("Product not found");
          router.push("/admin/products");
          return;
        }
        setProduct(p);
        // Seed selected categories: primary first, then any extras from the m2m.
        const extra = Array.isArray(p.categories)
          ? p.categories.map((c: any) => c.id).filter((cid: string) => cid !== p.categoryId)
          : [];
        setCategoryIds(p.categoryId ? [p.categoryId, ...extra] : extra);
        setForm({
          name: p.name || "",
          slug: p.slug || "",
          description: p.description || "",
          mrp: String(p.mrp || ""),
          salePrice: p.salePrice != null ? String(p.salePrice) : "",
          sellingPrice: p.sellingPrice != null ? String(p.sellingPrice) : "",
          onlinePrice: p.onlinePrice != null ? String(p.onlinePrice) : "",
          costPrice: p.costPrice != null ? String(p.costPrice) : "",
          maxDiscountPct: p.maxDiscountPct != null ? String(p.maxDiscountPct) : "",
          resellerPrice: p.resellerPrice != null ? String(p.resellerPrice) : "",
          taxSlabId: p.taxSlabId || "",
          brand: p.brand || "",
          season: p.season || "ALL",
          gender: p.gender || "UNISEX",
          status: p.status || "DRAFT",
          showOnWebsite: p.showOnWebsite ?? true,
          material: p.material || "",
          careInstructions: p.careInstructions || "",
          tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
        });
        setImages(
          (p.images || []).map((img: any, i: number) => ({
            url: img.url,
            alt: img.alt || "",
            color: img.color || "",
            isPrimary: img.isPrimary || i === 0,
          }))
        );
        setVariants(
          (p.variants || []).map((v: any) => ({
            id: v.id || String(Math.random()),
            sku: v.sku || "",
            size: v.size || "",
            color: v.color || "",
            colorHex: v.colorHex || "#000000",
            priceOverride: v.priceOverride != null ? String(v.priceOverride) : "",
            // Prefill MRP / PR from the variant, falling back to the product's
            // values so every row shows a filled figure (editable per variant).
            mrp: v.mrp != null ? String(v.mrp) : p.mrp != null ? String(p.mrp) : "",
            costPrice: v.costPrice != null ? String(v.costPrice) : p.costPrice != null ? String(p.costPrice) : "",
            stock: String(v.stock ?? 0),
            incentiveType: v.incentiveType === "AMOUNT" ? "AMOUNT" : "PERCENT",
            incentiveValue: v.incentiveValue != null ? String(v.incentiveValue) : "1",
          }))
        );
      })
      .catch(() => {
        toast.error("Failed to load product");
        router.push("/admin/products");
      })
      .finally(() => setFetchingProduct(false));

    // Categories handled by <CategoryMultiSelect/> (fetches its own list).

    // Fetch tax slabs
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
  }, [productId, router]);

  const addVariant = () => {
    // Temp id (not a DB cuid) → the PUT API treats it as a brand-new variant
    // and allocates a fresh SS-N code on save.
    setVariants([
      ...variants,
      { id: `new-${Date.now()}`, sku: "", size: "", color: "", colorHex: "#000000", priceOverride: "", mrp: form.mrp || "", costPrice: form.costPrice || "", stock: "0", incentiveType: "PERCENT", incentiveValue: "1" },
    ]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
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
  // Highlight the dropzone while files are dragged over it (drag & drop upload).
  const [dragActive, setDragActive] = useState(false);

  // Compress each picked file to 1080p WebP and upload straight to S3.
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file, form.slug || form.name || "product");
        // Persist to the product immediately so the S3 object is referenced
        // the instant it's uploaded — even if the form is reloaded or closed
        // before Save. The product save later does a full image replace, but
        // since this url is in `images` state it survives. Idempotent on url.
        try {
          await fetch(`/api/admin/products/${productId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, alt: form.name || "Product image" }),
          });
        } catch {
          /* non-fatal: the image is still in form state and saves with the form */
        }
        setImages((prev) => [
          ...prev,
          { url, alt: form.name || "Product image", color: "", isPrimary: prev.length === 0 },
        ]);
      }
      toast.success("Image uploaded & saved");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index: number) => {
    const target = images[index];
    // Update the UI immediately…
    setImages(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, isPrimary: i === 0 })));
    // …and actually delete it server-side. The product Save no longer removes
    // images (so uploads can't be wiped), so removal must be explicit here.
    if (target?.url) {
      try {
        await fetch(
          `/api/admin/products/${productId}/images?url=${encodeURIComponent(target.url)}`,
          { method: "DELETE" }
        );
      } catch {
        toast.error("Could not remove the image — refresh and try again");
      }
    }
  };

  const setImageColor = (index: number, color: string) => {
    setImages(images.map((img, i) => (i === index ? { ...img, color } : img)));
  };

  // Reorder images. Primary/head image is always position 0 — so the gallery
  // order on the storefront matches this order, and the first one is the head.
  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((img, i) => ({ ...img, isPrimary: i === 0 }));
    });
  };
  // "Set as head" = move this image to the front (becomes primary).
  const makeHeadImage = (index: number) => moveImage(index, 0);

  const variantColors = Array.from(
    new Set(variants.map((v) => v.color.trim()).filter(Boolean))
  );

  // Barcode-print rows for this product — only SAVED variants (those with a
  // server-assigned code; barcode == sku here). Stock + price come from the
  // live form so the default print quantity reflects the current stock.
  const barcodeRows = variants
    .filter((v) => v.sku && v.sku.trim())
    .map((v) => ({
      variantId: v.id,
      productName: form.name || "Product",
      sku: v.sku,
      barcode: v.sku,
      label: [v.size, v.color].filter(Boolean).join(" / ") || "—",
      stock: parseInt(v.stock) || 0,
      price:
        (v.priceOverride ? parseFloat(v.priceOverride) : 0) ||
        (form.sellingPrice ? parseFloat(form.sellingPrice) : 0) ||
        (form.onlinePrice ? parseFloat(form.onlinePrice) : 0) ||
        (form.mrp ? parseFloat(form.mrp) : 0) ||
        0,
    }));

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) {
      toast.error("Wait for the image upload to finish before saving");
      return;
    }
    if (categoryIds.length === 0) {
      toast.error("Pick at least one category");
      return;
    }
    setLoading(true);

    try {
      const payload = {
        id: productId,
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
        tags: form.tags
          ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        images: images.map((img, i) => ({ ...img, isPrimary: i === 0 })),
        // Send the variant id so the API can do a non-destructive diff:
        //   existing id  → update (keeps its SS-N code)
        //   temp "new-…" → create with a fresh code
        //   omitted row  → deleted (its code stays retired forever)
        // SKU/barcode are owned by the server, so we don't send them.
        variants: variants
          .filter((v) => v.sku.trim() || v.size.trim() || v.color.trim() || v.priceOverride.trim() || parseInt(v.stock) > 0)
          .map((v) => ({
            // Always send the id; the API matches it against the product's real
            // variant ids — a temp "new-…" id simply isn't found, so it's created.
            id: v.id,
            size: v.size || undefined,
            color: v.color || undefined,
            colorHex: v.color.trim() ? v.colorHex || undefined : undefined,
            priceOverride: v.priceOverride ? parseFloat(v.priceOverride) : undefined,
            mrp: v.mrp ? parseFloat(v.mrp) : undefined,
            costPrice: v.costPrice ? parseFloat(v.costPrice) : undefined,
            stock: parseInt(v.stock) || 0,
            incentiveType: v.incentiveType === "AMOUNT" ? "AMOUNT" : "PERCENT",
            incentiveValue: v.incentiveValue ? parseFloat(v.incentiveValue) : 1,
          })),
      };

      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product");

      toast.success("Product updated!");
      router.push("/admin/products");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to archive this product? This action cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products?id=${productId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Product archived");
      router.push("/admin/products");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProduct) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-nate-grey-500">Loading product...</div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Edit Product</h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-nate-grey-500 hover:text-nate-grey-700"
        >
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
            {/* Website visibility — POS always keeps the product regardless.
                Sits beside Brand so the row's right half isn't wasted. */}
            <div className="flex items-center md:pt-6">
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
              <label className="block text-sm font-medium text-nate-grey-700 mb-1">Tax Slab</label>
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
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverIndex !== i) setDragOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== i) moveImage(dragIndex, i);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`relative group cursor-move rounded-lg transition-shadow ${
                    i === 0 ? "ring-2 ring-accent" : ""
                  } ${dragIndex === i ? "opacity-40" : ""} ${
                    dragOverIndex === i && dragIndex !== i ? "ring-2 ring-blue-400" : ""
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.alt}
                    className="w-full aspect-square object-cover rounded-lg border-2 border-nate-grey-200 pointer-events-none"
                  />
                  {i === 0 ? (
                    <span className="absolute top-2 left-2 bg-accent text-nate-grey-800 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> Head
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeHeadImage(i)}
                      title="Set as head (main) image"
                      className="absolute top-2 left-2 bg-white/90 text-nate-grey-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-nate-grey-200"
                    >
                      <Star className="w-3 h-3" /> Set head
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {/* Position badge + drag affordance (drag the card to reorder) */}
                  <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-semibold text-white bg-nate-grey-900/70 rounded-full pl-1 pr-1.5 leading-5">
                    <GripVertical className="w-3 h-3" />
                    {i + 1}
                  </span>
                  {/* Per-image colour tag → PDP colour→image swap. */}
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
                    {/* Preserve a previously-saved colour even if its variant
                        row was removed, so it isn't silently lost on save. */}
                    {img.color && !variantColors.includes(img.color) && (
                      <option value={img.color}>{img.color}</option>
                    )}
                  </select>
                </div>
              ))}
            </div>
          )}
          {images.length > 0 && (
            <p className="text-xs text-nate-grey-400 mt-2">
              The <strong>Head</strong> image (★, position 1) is the main/cover image. Hover
              an image to <strong>set it as head</strong>, or <strong>drag</strong> the tiles to reorder. Save to apply.
            </p>
          )}
          {images.length > 0 && variantColors.length > 0 && (
            <p className="text-xs text-nate-grey-400 mt-1">
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
            <div className="flex items-center gap-2">
              <ProductBarcodeButton rows={barcodeRows} productName={form.name || "Product"} />
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 px-4 py-2 bg-nate-grey-100 text-nate-grey-700 rounded-lg text-sm font-medium hover:bg-nate-grey-200"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-nate-grey-500 border-b border-nate-grey-200">
                  <th className="pb-3 pr-4">Code</th>
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3 pr-4">Color</th>
                  <th className="pb-3 pr-4">Swatch</th>
                  <th className="pb-3 pr-4">Price Override</th>
                  <th className="pb-3 pr-4">MRP</th>
                  <th className="pb-3 pr-4">PR</th>
                  <th className="pb-3 pr-4">Stock</th>
                  <th className="pb-3 pr-4">Incentive</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-nate-grey-100">
                    <td className="py-3 pr-4">
                      <span className="inline-block font-mono text-xs text-nate-grey-600 bg-nate-grey-50 border border-nate-grey-200 rounded px-2 py-2 w-20 text-center">
                        {v.sku || "auto"}
                      </span>
                    </td>
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
                        value={v.mrp}
                        onChange={(e) => updateVariant(v.id, "mrp", e.target.value)}
                        className="border border-nate-grey-200 rounded px-2 py-2 w-20 focus:ring-1 focus:ring-accent"
                        placeholder="MRP"
                        title="Maximum Retail Price for this variant"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="text" inputMode="decimal"
                        value={v.costPrice}
                        onChange={(e) => updateVariant(v.id, "costPrice", e.target.value)}
                        className="border border-nate-grey-200 rounded px-2 py-2 w-20 focus:ring-1 focus:ring-accent"
                        placeholder="PR"
                        title="PR — purchase / cost rate for this variant"
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

        {/* Additional Info */}
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

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || uploading}
            className="flex-1 bg-nate-grey-800 text-white py-4 rounded-lg font-medium hover:bg-nate-grey-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : uploading ? "Uploading image…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-6 py-4 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Archive
          </button>
        </div>
      </form>

      {/* Stock ledger: where this product came from (supplier bills) and where
          it went (orders it was sold on). Read-only, lazy-loaded. */}
      <div className="mt-8">
        <ProductLedger productId={productId} />
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronUp, ChevronDown, ArrowUpToLine, ArrowDownToLine, Loader2, Check, Trash2, Barcode, FolderInput } from "lucide-react";
import toast from "react-hot-toast";

type Product = {
  id: string;
  name: string;
  slug: string;
  status: string;
  mrp: number;
  onlinePrice: number | null;
  salePrice?: number | null;
  showOnWebsite: boolean;
  location: string;
  images: { url: string }[];
  variants: { id: string; stock: number; comparePrice?: number | null }[];
  category: { name: string; discountPct?: number | null } | null;
};

interface SortableHeaderProps {
  label: string;
  baseKey: "name" | "category" | "status" | "price";
  currentSort: string;
  onSort: (newSort: string) => void;
}

function SortableHeader({ label, baseKey, currentSort, onSort }: SortableHeaderProps) {
  const asc = baseKey;
  const desc = `${baseKey}-desc`;
  const isAsc = currentSort === asc;
  const isDesc = currentSort === desc;
  const next = isAsc ? desc : asc;
  return (
    <th
      className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide cursor-pointer select-none hover:text-nate-grey-700"
      onClick={() => onSort(next)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isAsc && <ChevronUp className="w-3 h-3" />}
        {isDesc && <ChevronDown className="w-3 h-3" />}
      </span>
    </th>
  );
}

type CategoryOption = { id: string; name: string; slug: string; parentId: string | null };

// New-category picker sentinel for the bulk category <select>.
const NEW_CATEGORY = "__new__";

export function ProductsTableClient({
  products,
  currentSort = "newest",
  scope = null,
  categories = [],
}: {
  products: Product[];
  currentSort?: string;
  /** When set, Move to top/bottom reorders within this category/collection. */
  scope?: { type: "category" | "collection"; id: string } | null;
  /** Categories to move a selection into (bulk "move to category"). */
  categories?: CategoryOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Selection for bulk reorder. Local copy of showOnWebsite for optimistic
  // toggle UI (server is source of truth on next load).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [webState, setWebState] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // Bulk dropdowns in the black bar. "" = leave unchanged.
  const [bulkLocation, setBulkLocation] = useState<"" | "STORE" | "GODOWN">("");
  const [bulkVisibility, setBulkVisibility] = useState<"" | "VISIBLE" | "HIDDEN">("");
  const [visTouched, setVisTouched] = useState(false);
  // Bulk "move to category": "" = leave unchanged, a category id, or NEW_CATEGORY
  // (then newCatName holds the name of the category to create on the fly).
  const [bulkCategory, setBulkCategory] = useState("");
  const [newCatName, setNewCatName] = useState("");

  const isOn = (p: Product) => webState[p.id] ?? p.showOnWebsite;

  // Picking a location suggests a sensible default visibility (Godown → Hidden,
  // Store → Visible) the admin can still override. Only auto-fills while the
  // visibility dropdown is untouched.
  function chooseLocation(loc: "" | "STORE" | "GODOWN") {
    setBulkLocation(loc);
    if (!visTouched) {
      if (loc === "GODOWN") setBulkVisibility("HIDDEN");
      else if (loc === "STORE") setBulkVisibility("VISIBLE");
    }
  }

  async function deleteSelected() {
    if (selected.size === 0 || busy) return;
    const n = selected.size;
    if (
      !window.confirm(
        `Permanently delete ${n} product${n === 1 ? "" : "s"}? This removes them and all their variants/images. Past orders keep their records. This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      const ids = products.filter((p) => selected.has(p.id)).map((p) => p.id);
      const res = await fetch("/api/admin/products/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Delete failed");
        return;
      }
      toast.success(`Deleted ${d.deleted} product${d.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function applyBulk() {
    if (selected.size === 0 || busy) return;
    const wantsCategory =
      bulkCategory === NEW_CATEGORY ? !!newCatName.trim() : !!bulkCategory;
    if (!bulkLocation && !bulkVisibility && !wantsCategory) {
      toast.error("Pick a location, visibility, or category");
      return;
    }
    setBusy(true);
    try {
      // Resolve the target category first — creating it on the fly if the admin
      // chose "New category…".
      let categoryId: string | undefined;
      let categoryLabel: string | undefined;
      if (bulkCategory === NEW_CATEGORY) {
        const name = newCatName.trim();
        // Same slug rule the categories page uses (server doesn't derive it).
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        if (!slug) {
          toast.error("Enter a valid category name");
          setBusy(false);
          return;
        }
        const cr = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug }),
        });
        const cd = await cr.json().catch(() => ({}));
        if (!cr.ok) {
          toast.error(
            cr.status === 409
              ? "A category with that name already exists — pick it from the list"
              : cd?.error ?? "Could not create category"
          );
          setBusy(false);
          return;
        }
        categoryId = cd.id;
        categoryLabel = name;
      } else if (bulkCategory) {
        categoryId = bulkCategory;
        categoryLabel = categories.find((c) => c.id === bulkCategory)?.name;
      }

      const ids = products.filter((p) => selected.has(p.id)).map((p) => p.id);
      const payload: {
        ids: string[];
        location?: string;
        showOnWebsite?: boolean;
        categoryId?: string;
      } = { ids };
      if (bulkLocation) payload.location = bulkLocation;
      if (bulkVisibility) payload.showOnWebsite = bulkVisibility === "VISIBLE";
      if (categoryId) payload.categoryId = categoryId;
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Update failed");
        return;
      }
      const bits = [
        categoryLabel ? `moved to ${categoryLabel}` : null,
        bulkLocation ? `location → ${bulkLocation === "STORE" ? "Store" : "Godown"}` : null,
        bulkVisibility ? `${bulkVisibility === "VISIBLE" ? "visible" : "hidden"} on website` : null,
      ].filter(Boolean);
      toast.success(`Updated ${d.updated} product${d.updated === 1 ? "" : "s"} — ${bits.join(", ")}`);
      setSelected(new Set());
      setBulkLocation("");
      setBulkVisibility("");
      setVisTouched(false);
      setBulkCategory("");
      setNewCatName("");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  const setSort = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", next);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPageSelected =
    products.length > 0 && products.every((p) => selected.has(p.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      if (products.every((p) => prev.has(p.id))) {
        const next = new Set(prev);
        products.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      products.forEach((p) => next.add(p.id));
      return next;
    });

  async function move(position: "top" | "bottom") {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      // Selection order on the page is the visual order; send ids in that
      // order so the topmost selected ends up highest.
      const ids = products.filter((p) => selected.has(p.id)).map((p) => p.id);
      const res = await fetch("/api/admin/products/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, position, scope: scope ?? undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Reorder failed");
        return;
      }
      toast.success(
        `Moved ${ids.length} to ${position}${scope ? ` in this ${scope.type}` : ""}`
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWebsite(p: Product) {
    const nextVal = !isOn(p);
    setWebState((m) => ({ ...m, [p.id]: nextVal })); // optimistic
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnWebsite: nextVal }),
      });
      if (!res.ok) {
        setWebState((m) => ({ ...m, [p.id]: !nextVal })); // revert
        toast.error("Could not update visibility");
      }
    } catch {
      setWebState((m) => ({ ...m, [p.id]: !nextVal }));
      toast.error("Network error");
    }
  }

  return (
    <>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 bg-nate-grey-900 text-white text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => move("top")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpToLine className="w-3.5 h-3.5" />}
              Move to top
            </button>
            <button
              onClick={() => move("bottom")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Move to bottom
            </button>
          </div>

          {/* Location + website visibility — each optional (unset = unchanged) */}
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/15">
            <select
              value={bulkLocation}
              onChange={(e) => chooseLocation(e.target.value as "" | "STORE" | "GODOWN")}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-md bg-white/15 text-white text-xs outline-none cursor-pointer disabled:opacity-50 [&>option]:text-nate-grey-900"
              title="Set stock location"
            >
              <option value="">Location…</option>
              <option value="STORE">Store</option>
              <option value="GODOWN">Godown</option>
            </select>
            <select
              value={bulkVisibility}
              onChange={(e) => {
                setVisTouched(true);
                setBulkVisibility(e.target.value as "" | "VISIBLE" | "HIDDEN");
              }}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-md bg-white/15 text-white text-xs outline-none cursor-pointer disabled:opacity-50 [&>option]:text-nate-grey-900"
              title="Set website visibility"
            >
              <option value="">Visibility…</option>
              <option value="VISIBLE">Visible</option>
              <option value="HIDDEN">Hidden</option>
            </select>
            {/* Move to category (existing or a new one, created on the fly) */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-white/15">
              <FolderInput className="w-3.5 h-3.5 text-white/60" />
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                disabled={busy}
                className="px-2.5 py-1.5 rounded-md bg-white/15 text-white text-xs outline-none cursor-pointer disabled:opacity-50 [&>option]:text-nate-grey-900 max-w-[11rem]"
                title="Move selected products to a category"
              >
                <option value="">Move to category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? `— ${c.name}` : c.name}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
              {bulkCategory === NEW_CATEGORY && (
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  disabled={busy}
                  autoFocus
                  placeholder="New category name"
                  className="px-2.5 py-1.5 rounded-md bg-white/15 text-white placeholder:text-white/50 text-xs outline-none w-40 disabled:opacity-50"
                />
              )}
            </div>
            <button
              onClick={applyBulk}
              disabled={
                busy ||
                (!bulkLocation &&
                  !bulkVisibility &&
                  (bulkCategory === NEW_CATEGORY ? !newCatName.trim() : !bulkCategory))
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-nate-grey-900 font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Apply
            </button>
          </div>

          <button
            onClick={deleteSelected}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/90 hover:bg-red-500 text-white disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-white/70 hover:text-white text-xs"
          >
            Clear
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-nate-grey-50 border-b border-nate-grey-200">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 accent-black cursor-pointer"
                aria-label="Select all on page"
              />
            </th>
            <SortableHeader label="Product" baseKey="name" currentSort={currentSort} onSort={setSort} />
            <SortableHeader label="Category" baseKey="category" currentSort={currentSort} onSort={setSort} />
            <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Stock</th>
            <SortableHeader label="Status" baseKey="status" currentSort={currentSort} onSort={setSort} />
            <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Location</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Website</th>
            <SortableHeader label="Price" baseKey="price" currentSort={currentSort} onSort={setSort} />
            <th className="w-32"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nate-grey-100">
          {products.map((product) => (
            <tr
              key={product.id}
              onClick={() => router.push(`/admin/products/${product.id}`)}
              className={`group relative cursor-pointer transition-colors ${
                selected.has(product.id) ? "bg-accent/5" : "hover:bg-nate-grey-50"
              }`}
            >
              <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggleSelect(product.id)}
                  className="h-4 w-4 accent-black cursor-pointer"
                  aria-label={`Select ${product.name}`}
                />
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 group/thumb shrink-0">
                    <div className="w-full h-full bg-nate-grey-200 rounded overflow-hidden">
                      {product.images[0]?.url && (
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      )}
                    </div>
                    {product.images[0]?.url && (
                      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-14 z-30 w-96 h-96 rounded-xl bg-white shadow-2xl border border-nate-grey-200 overflow-hidden opacity-0 scale-90 transition-all duration-150 group-hover/thumb:opacity-100 group-hover/thumb:scale-100">
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="w-full h-full object-contain bg-nate-grey-50 p-3"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-nate-grey-700">{product.name}</p>
                    <p className="text-xs text-nate-grey-400">{product.slug}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-nate-grey-600">{product.category?.name ?? "—"}</td>
              <td className="px-6 py-4 text-sm tabular-nums">
                {(() => {
                  const stock = product.variants.reduce((s, v) => s + v.stock, 0);
                  return (
                    <span className={stock === 0 ? "text-red-600 font-medium" : "text-nate-grey-700"}>
                      {stock.toLocaleString("en-IN")}
                    </span>
                  );
                })()}
              </td>
              <td className="px-6 py-4">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  product.status === "ACTIVE"   ? "bg-green-100 text-green-700" :
                  product.status === "DRAFT"    ? "bg-yellow-100 text-yellow-700" :
                                                  "bg-nate-grey-100 text-nate-grey-600"
                }`}>
                  {product.status}
                </span>
              </td>
              {/* Stock location */}
              <td className="px-6 py-4">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    product.location === "GODOWN"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-nate-grey-100 text-nate-grey-600"
                  }`}
                >
                  {product.location === "GODOWN" ? "Godown" : "Store"}
                </span>
              </td>
              {/* Website visibility toggle */}
              <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleWebsite(product)}
                  className={`inline-flex items-center w-10 h-5 rounded-full px-0.5 transition-colors ${
                    isOn(product) ? "bg-nate-grey-900 justify-end" : "bg-nate-grey-300 justify-start"
                  }`}
                  aria-pressed={isOn(product)}
                  title={isOn(product) ? "Visible on website" : "Hidden from website (POS only)"}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </button>
              </td>
              <td className="px-6 py-4 text-sm font-medium text-nate-grey-700">
                {(() => {
                  const sell = product.onlinePrice ?? product.mrp;
                  // Same "special" test as the storefront: category discount, a
                  // sale price under MRP, or a variant with a higher compare price.
                  const special =
                    (product.category?.discountPct ?? 0) > 0 ||
                    (product.salePrice != null && product.salePrice > sell) ||
                    product.variants.some((v) => v.comparePrice != null && v.comparePrice > sell);
                  return (
                    <span className={special ? "price-special" : ""}>
                      ₹{sell.toLocaleString("en-IN")}
                    </span>
                  );
                })()}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <a
                    href={`/shop/${product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs px-3 py-1.5 rounded-md bg-nate-grey-100 text-nate-grey-600 hover:bg-nate-grey-200 transition-colors font-medium"
                  >
                    View
                  </a>
                  <a
                    href={`/admin/barcodes?product=${product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Print barcodes for this product"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-nate-grey-100 text-nate-grey-600 hover:bg-nate-grey-200 transition-colors font-medium"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    Barcodes
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/products/${product.id}`);
                    }}
                    className="text-xs px-3 py-1.5 rounded-md bg-nate-grey-800 text-white hover:bg-nate-grey-700 transition-colors font-medium"
                  >
                    Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

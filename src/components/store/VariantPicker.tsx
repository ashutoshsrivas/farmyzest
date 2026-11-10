"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/store";

type Variant = {
  id: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  stock: number;
  priceOverride: number | null;
  comparePrice: number | null;
};

// Quick size/colour picker shown when a shopper clicks Add/Buy on a product
// card that has more than one variant — so they choose instead of us guessing.
// `mode` decides what happens after a successful pick: "add" opens the cart,
// "buy" jumps to checkout.
export function VariantPicker({
  slug,
  name,
  imageUrl,
  basePrice,
  mode,
  onClose,
}: {
  slug: string;
  name: string;
  imageUrl: string;
  basePrice: number;
  mode: "add" | "buy";
  onClose: () => void;
}) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const setCartOpen = useCartStore((s) => s.setIsOpen);

  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [productId, setProductId] = useState("");
  const [productPrice, setProductPrice] = useState(basePrice);
  // Whether this product is a "special price" (category discount or a sale
  // price sitting below MRP) and the reference (pre-discount) price to strike.
  const [productSpecial, setProductSpecial] = useState(false);
  const [productMrp, setProductMrp] = useState<number | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (cancelled || !p) {
          if (!cancelled) setVariants([]);
          return;
        }
        setProductId(p.id);
        const sell = p.onlinePrice ?? p.mrp ?? basePrice;
        setProductPrice(sell);
        setVariants(p.variants ?? []);
        // Special when the category applies a discount, or a sale/MRP reference
        // sits above the selling price.
        const catDisc = (p.category?.discountPct ?? 0) > 0;
        const ref = p.salePrice ?? p.mrp ?? null;
        const refSpecial = ref != null && ref > sell;
        setProductSpecial(catDisc || refSpecial);
        setProductMrp(refSpecial ? ref : catDisc ? p.mrp ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setVariants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, basePrice]);

  const sizes = useMemo(
    () => Array.from(new Set((variants ?? []).map((v) => v.size).filter(Boolean))) as string[],
    [variants]
  );
  const colors = useMemo(() => {
    const m = new Map<string, string | null>();
    (variants ?? []).forEach((v) => {
      if (v.color) m.set(v.color, v.colorHex);
    });
    return Array.from(m, ([c, hex]) => ({ color: c, hex }));
  }, [variants]);

  const variantFor = (s: string | null, c: string | null) =>
    (variants ?? []).find(
      (v) => (s == null || v.size === s) && (c == null || v.color === c)
    );

  // A size/colour is selectable if some in-stock variant offers it alongside the
  // current opposite-axis selection.
  const sizeInStock = (s: string) =>
    (variants ?? []).some(
      (v) => v.size === s && (color == null || v.color === color) && v.stock > 0
    );
  const colorInStock = (c: string) =>
    (variants ?? []).some(
      (v) => v.color === c && (size == null || v.size === size) && v.stock > 0
    );

  const selected = variantFor(size, color);
  const price = selected?.priceOverride ?? productPrice;
  const needsSize = sizes.length > 0 && size == null;
  const needsColor = colors.length > 0 && color == null;
  const canConfirm = !!selected && selected.stock > 0 && !needsSize && !needsColor;

  const confirm = () => {
    if (!selected || selected.stock <= 0) {
      toast.error("Please pick an in-stock option");
      return;
    }
    const variantSpecial = !!(selected.comparePrice && selected.comparePrice > price);
    const isSpecial = productSpecial || variantSpecial;
    addItem({
      variantId: selected.id,
      productId,
      name,
      variantLabel: [selected.color, selected.size].filter(Boolean).join(" / "),
      price,
      imageUrl,
      stock: selected.stock,
      isSpecial,
      mrp: isSpecial ? selected.comparePrice ?? productMrp ?? null : null,
    });
    onClose();
    if (mode === "buy") {
      router.push("/checkout");
    } else {
      setCartOpen(true);
      toast.success("Added to bag");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-lg shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-grey-200 sticky top-0 bg-white">
          <div className="relative w-12 h-14 bg-grey-100 overflow-hidden flex-shrink-0">
            {imageUrl && (
              <Image src={imageUrl} alt={name} fill className="object-cover" sizes="48px" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-grey-900 line-clamp-1">{name}</h3>
            <p className="text-sm font-semibold text-grey-900 tabular-nums">
              ₹{price.toLocaleString("en-IN")}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-grey-500 hover:text-grey-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {variants === null ? (
            <div className="flex items-center justify-center py-10 text-grey-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : variants.length === 0 ? (
            <p className="text-sm text-grey-500 py-6 text-center">
              This product isn&apos;t available right now.
            </p>
          ) : (
            <>
              {colors.length > 0 && (
                <div>
                  <p className="text-[11px] font-sans uppercase tracking-[0.15em] text-grey-500 mb-2">
                    Colour{color ? `: ${color}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(({ color: c }) => {
                      const disabled = !colorInStock(c);
                      const active = color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={disabled}
                          onClick={() => setColor(active ? null : c)}
                          title={c}
                          className={`min-w-[44px] px-3 py-2 text-sm capitalize border transition ${
                            active
                              ? "border-grey-900 bg-grey-900 text-white"
                              : "border-grey-300 text-grey-800 hover:border-grey-600"
                          } ${disabled ? "opacity-30 cursor-not-allowed line-through" : ""}`}
                        >
                          {c.toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sizes.length > 0 && (
                <div>
                  <p className="text-[11px] font-sans uppercase tracking-[0.15em] text-grey-500 mb-2">
                    Size{size ? `: ${size}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => {
                      const disabled = !sizeInStock(s);
                      const active = size === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSize(active ? null : s)}
                          className={`min-w-[44px] px-3 py-2 text-sm border transition ${
                            active
                              ? "border-grey-900 bg-grey-900 text-white"
                              : "border-grey-300 text-grey-800 hover:border-grey-600"
                          } ${disabled ? "opacity-30 cursor-not-allowed line-through" : ""}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={confirm}
                disabled={!canConfirm}
                className="w-full bg-grey-900 text-white text-sm font-medium uppercase tracking-[0.1em] py-3.5 hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {needsSize || needsColor
                  ? "Select options"
                  : selected && selected.stock <= 0
                    ? "Out of stock"
                    : mode === "buy"
                      ? "Buy now"
                      : "Add to bag"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

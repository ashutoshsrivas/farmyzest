"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Zap, Heart, Maximize2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/store";
import { useWishlist } from "@/lib/wishlist";
import { VariantPicker } from "@/components/store/VariantPicker";

type ProductCardProps = {
  id: string;
  slug: string;
  name: string;
  price: number;
  comparePrice?: number | null;
  imageUrl: string;
  categoryName?: string;
  isNew?: boolean;
  // Optional quick-add data. When variantId is present the hover buttons add
  // straight to the cart; otherwise they fall back to navigating to the PDP
  // (where the shopper can pick a size/colour first).
  productId?: string;
  variantId?: string | null;
  variantLabel?: string;
  stock?: number;
  /** First few technical specs, shown in mono under the name. */
  specs?: ProductSpec[];
  /** Sample catalogue row — shows a "Sample" tag so it is never taken for stock. */
  isDemo?: boolean;
};

export type ProductSpec = { label: string; value: string; unit?: string };

export function formatSpec(s: ProductSpec) {
  return `${s.value}${s.unit ? ` ${s.unit}` : ""}`;
}

export function ProductCard({
  id,
  slug,
  name,
  price,
  comparePrice,
  imageUrl,
  categoryName,
  isNew = false,
  productId,
  specs,
  isDemo = false,
}: ProductCardProps) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const setCartOpen = useCartStore((s) => s.setIsOpen);
  const wishToggle = useWishlist((s) => s.toggle);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // When set, the size/colour picker is open for an "add" or "buy" action.
  const [picker, setPicker] = useState<"add" | "buy" | null>(null);

  // Hover slideshow: on the first hover we lazily load the product's images and
  // then auto-cycle through them (crossfade) while the pointer stays on the card.
  const [hovering, setHovering] = useState(false);
  const [slides, setSlides] = useState<string[] | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const slidesFetched = useRef(false);

  async function loadSlides() {
    if (slidesFetched.current) return;
    slidesFetched.current = true;
    try {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) return;
      const p = await res.json();
      const urls: string[] = Array.isArray(p.images)
        ? p.images.map((i: { url: string }) => i.url).filter(Boolean)
        : [];
      // Lead with the already-shown primary image; drop dupes.
      const ordered = [imageUrl, ...urls.filter((u) => u !== imageUrl)].filter(Boolean);
      if (ordered.length > 1) setSlides(ordered);
    } catch {
      /* no slideshow if the fetch fails — the primary image still shows */
    }
  }

  function onCardEnter() {
    setHovering(true);
    loadSlides();
  }
  function onCardLeave() {
    setHovering(false);
    setSlideIdx(0);
  }

  // Advance one image per second while hovering (only when there's >1 image).
  useEffect(() => {
    if (!hovering || !slides || slides.length < 2) return;
    const id = setInterval(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, 1000);
    return () => clearInterval(id);
  }, [hovering, slides]);

  const href = `/shop/${slug}`;
  // Subscribe to the item list (not the `has` fn) so the heart re-renders the
  // moment this product is added/removed anywhere.
  const wished = useWishlist((s) => s.items.some((i) => i.productId === (productId ?? id)));

  // What happens when Add/Buy is clicked. We fetch the product's variants and:
  //   • 0 variants  → unavailable
  //   • 1 variant   → add it straight away (nothing to choose)
  //   • 2+ variants → open the size/colour picker so the shopper chooses
  // This is why we never trust a single pre-passed variant for multi-variant
  // products — the shopper must pick their size/colour.
  async function handleAction(mode: "add" | "buy") {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) {
        toast.error("This product can't be added right now");
        return;
      }
      const p = await res.json();
      const variants: Array<{
        id: string;
        size: string | null;
        color: string | null;
        priceOverride: number | null;
        stock: number;
      }> = p.variants ?? [];
      if (variants.length === 0) {
        toast.error("This product can't be added right now");
        return;
      }
      if (variants.length > 1) {
        setPicker(mode);
        return;
      }
      const only = variants[0];
      if (only.stock <= 0) {
        toast.error("Out of stock");
        return;
      }
      const unit = only.priceOverride ?? price;
      const isSpecial = !!(comparePrice && comparePrice > unit);
      addItem({
        variantId: only.id,
        productId: p.id,
        name,
        variantLabel: [only.color, only.size].filter(Boolean).join(" / "),
        price: unit,
        imageUrl,
        stock: only.stock,
        isSpecial,
        mrp: isSpecial ? comparePrice ?? null : null,
      });
      if (mode === "buy") {
        router.push("/checkout");
      } else {
        setCartOpen(true);
        toast.success("Added to bag");
      }
    } catch {
      toast.error("This product can't be added right now");
    } finally {
      setBusy(false);
    }
  }

  function onAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    handleAction("add");
  }

  function onBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    handleAction("buy");
  }

  function onWish(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const wasWished = wished;
    wishToggle({
      productId: productId ?? id,
      slug,
      name,
      price,
      imageUrl,
      categoryName,
    });
    if (wasWished) toast("Removed from wishlist");
    else toast.success("Added to wishlist");
  }

  function onZoom(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (imageUrl) setZoomOpen(true);
  }

  return (
    <>
      <div className="group block">
        {/* Image with hover overlay */}
        <div
          className="relative aspect-[4/5] overflow-hidden bg-sand"
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        >
          <Link href={href} aria-label={name} className="absolute inset-0 z-0">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />
            ) : (
              <div className="w-full h-full flex items-end p-3 bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(90,66,50,0.07)_10px_11px)]">
                <span className="cat-label !text-[0.65rem] text-stone">Photo to come</span>
              </div>
            )}
            {/* Extra images crossfade in over the primary while hovering. */}
            {slides?.map((url, i) =>
              i === 0 ? null : (
                <Image
                  key={url}
                  src={url}
                  alt={name}
                  fill
                  className={`object-cover transition-opacity duration-500 ease-out group-hover:scale-[1.04] ${
                    hovering && slideIdx === i ? "opacity-100" : "opacity-0"
                  }`}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              )
            )}
          </Link>

          {/* Badges */}
          {(isDemo || isNew) && (
            <span className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1 pointer-events-none">
              {isDemo && (
                <span className="cat-label !text-[0.62rem] bg-bone/95 text-[#8E3B2E] border border-[#8E3B2E]/40 px-1.5 py-0.5">
                  Sample
                </span>
              )}
              {isNew && <span className="cat-label !text-[0.62rem] bg-bone/95 text-charcoal px-1.5 py-0.5">New</span>}
            </span>
          )}

          {/* Top-right utility buttons (wishlist + zoom). Reveal on hover — but
              once wishlisted, keep the pink heart visible so its state shows. */}
          <div className={`absolute top-2.5 right-2.5 z-20 flex flex-col gap-1.5 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${wished ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}>
            <button
              onClick={onWish}
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              className="w-9 h-9 flex items-center justify-center bg-bone/95 border border-rule hover:bg-bone transition-colors"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${wished ? "fill-seg-ink text-seg-ink" : "text-charcoal"}`}
                strokeWidth={1.5}
              />
            </button>
            {imageUrl && (
              <button
                onClick={onZoom}
                aria-label="Zoom image"
                className="w-9 h-9 flex items-center justify-center bg-bone/95 border border-rule hover:bg-bone transition-colors"
              >
                <Maximize2 className="w-4 h-4 text-charcoal" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Bottom hover action bar */}
          <div className="absolute inset-x-0 bottom-0 z-20 hidden md:flex translate-y-full group-hover:translate-y-0 group-focus-within:translate-y-0 transition-transform duration-300 ease-out">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-bone/95 text-charcoal text-sm font-medium py-3 hover:bg-bone transition-colors disabled:opacity-60 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
              {busy ? "Adding…" : "Add to cart"}
            </button>
            <button
              type="button"
              onClick={onBuyNow}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-seg-ink text-bone text-sm font-medium py-3 hover:bg-accent-dark transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Zap className="w-4 h-4" strokeWidth={1.5} />
              Buy now
            </button>
          </div>
        </div>

        {/* Info */}
        <Link href={href} className="block mt-3 space-y-1">
          {categoryName && <p className="cat-label !text-[0.66rem] text-stone">{categoryName}</p>}
          <h3 className="text-[15px] leading-snug font-medium text-charcoal line-clamp-2 group-hover:text-seg-ink transition-colors duration-200">
            {name}
          </h3>
          {specs && specs.length > 0 && (
            <p className="font-mono text-xs text-stone line-clamp-1">
              {specs.slice(0, 3).map(formatSpec).join(" · ")}
            </p>
          )}
          <div className="flex items-baseline gap-2 pt-0.5">
            <span
              className={`text-base font-semibold tabular-nums ${
                comparePrice && comparePrice > price ? "price-special" : "text-charcoal"
              }`}
            >
              ₹{price.toLocaleString("en-IN")}
            </span>
            {comparePrice && comparePrice > price && (
              <span className="text-sm text-stone line-through tabular-nums">
                ₹{comparePrice.toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </Link>
        {/* Touch screens have no hover bar — give them a visible add button. */}
        <button
          type="button"
          onClick={onAddToCart}
          disabled={busy}
          className="md:hidden mt-2 w-full min-h-11 flex items-center justify-center gap-1.5 border border-seg-ink text-seg-ink text-sm font-medium active:bg-seg-tint disabled:opacity-60"
        >
          <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
          {busy ? "Adding…" : "Add to cart"}
        </button>
      </div>

      {/* Zoom lightbox */}
      {zoomOpen && imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomOpen(false);
            }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-[90vw] h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <Image src={imageUrl} alt={name} fill className="object-contain" sizes="90vw" />
          </div>
        </div>
      )}

      {/* Size/colour picker for multi-variant products */}
      {picker && (
        <VariantPicker
          slug={slug}
          name={name}
          imageUrl={imageUrl}
          basePrice={price}
          mode={picker}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

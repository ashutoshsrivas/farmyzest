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
};

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
    if (wasWished) toast("Removed from wishlist", { icon: "💔" });
    else toast.success("Added to wishlist", { icon: "💗" });
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
          className="relative aspect-[3/4] overflow-hidden bg-grey-200"
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
              <div className="w-full h-full bg-grey-200" />
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

          {/* New badge */}
          {isNew && (
            <span className="absolute top-3 left-3 z-10 text-[10px] uppercase tracking-[0.2em] text-grey-700 font-sans bg-white/90 px-2 py-1 pointer-events-none">
              New In
            </span>
          )}

          {/* Top-right utility buttons (wishlist + zoom). Reveal on hover — but
              once wishlisted, keep the pink heart visible so its state shows. */}
          <div className={`absolute top-2.5 right-2.5 z-20 flex flex-col gap-1.5 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${wished ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}>
            <button
              onClick={onWish}
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              className="w-8 h-8 flex items-center justify-center bg-white/95 backdrop-blur-sm shadow-sm hover:bg-white transition-colors rounded-full"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${wished ? "fill-pink-500 text-pink-500" : "text-grey-700"}`}
                strokeWidth={1.5}
              />
            </button>
            {imageUrl && (
              <button
                onClick={onZoom}
                aria-label="Zoom image"
                className="w-8 h-8 flex items-center justify-center bg-white/95 backdrop-blur-sm shadow-sm hover:bg-white transition-colors rounded-full"
              >
                <Maximize2 className="w-4 h-4 text-grey-700" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Bottom hover action bar */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/95 backdrop-blur-sm text-grey-900 text-[11px] font-medium uppercase tracking-[0.1em] py-3 hover:bg-white transition-colors disabled:opacity-60"
            >
              <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
              {busy ? "…" : "Add"}
            </button>
            <button
              type="button"
              onClick={onBuyNow}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-grey-900 text-white text-[11px] font-medium uppercase tracking-[0.1em] py-3 hover:bg-black transition-colors disabled:opacity-60"
            >
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
              Buy
            </button>
          </div>
        </div>

        {/* Info */}
        <Link href={href} className="block mt-3 space-y-0.5">
          {categoryName && (
            <p className="text-[10px] font-sans uppercase tracking-[0.15em] text-grey-500">
              {categoryName}
            </p>
          )}
          <h3 className="text-sm font-sans font-medium text-grey-800 line-clamp-1 group-hover:text-grey-600 transition-colors duration-200">
            {name}
          </h3>
          <div className="flex items-center gap-2 pt-0.5">
            <span
              className={`text-sm font-sans font-semibold tabular-nums ${
                comparePrice && comparePrice > price ? "price-special" : "text-grey-900"
              }`}
            >
              ₹{price.toLocaleString("en-IN")}
            </span>
            {comparePrice && comparePrice > price && (
              <span className="text-xs font-sans text-grey-400 line-through tabular-nums">
                ₹{comparePrice.toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </Link>
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

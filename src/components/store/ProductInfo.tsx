// src/components/store/ProductInfo.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/store";
import { useWishlist } from "@/lib/wishlist";

interface Variant {
  id: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  price: number;
}

interface ProductInfoProps {
  product: {
    id: string;
    name: string;
    description: string;
    mrp: number;
    onlinePrice: number;
    salePrice: number | null;
    category: string;
    sku: string;
    stock: number;
  };
  variants: Variant[];
  material?: string;
  care?: string;
  /** Optional callback fired when the shopper picks a colour swatch. PDP
   *  wrapper uses this to switch the gallery to that colour's image. */
  onColorSelected?: (color: string) => void;
  /** Product slug + primary image — needed so the wishlist heart can store a
   *  card-renderable entry. */
  slug?: string;
  imageUrl?: string;
}

export function ProductInfo({
  product,
  variants,
  material,
  care,
  onColorSelected,
  slug,
  imageUrl,
}: ProductInfoProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const addToCart = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const setCartOpen = useCartStore((s) => s.setIsOpen);
  const router = useRouter();
  const wishToggle = useWishlist((s) => s.toggle);
  // Subscribe to the list so the heart fills/empties immediately on toggle.
  const wishlisted = useWishlist((s) => s.items.some((i) => i.productId === product.id));

  function toggleWishlist() {
    const wasWished = wishlisted;
    wishToggle({
      productId: product.id,
      slug: slug ?? "",
      name: product.name,
      price: product.onlinePrice,
      imageUrl: imageUrl ?? "",
      categoryName: product.category,
    });
    if (wasWished) toast("Removed from wishlist", { icon: "💔" });
    else toast.success("Added to wishlist", { icon: "💗" });
  }

  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];

  // Out-of-stock variants are SHOWN (greyed + crossed), not hidden. These two
  // helpers tell us, for a given option, whether any matching variant is
  // actually purchasable right now — honouring the other axis' current pick.
  const comboInStock = (size: string | null, color: string | null) =>
    variants.some(
      (v) =>
        (!size || v.size === size) &&
        (!color || v.color === color) &&
        v.stock > 0
    );

  // A size is buyable if some in-stock variant exists for it (given the chosen
  // colour, if any). Same for colour given the chosen size.
  const sizeInStock = (size: string) => comboInStock(size, selectedColor);
  const colorInStock = (color: string) => comboInStock(selectedSize, color);

  const selectedVariant =
    variants.find(
      (v) =>
        (!selectedSize || v.size === selectedSize) &&
        (!selectedColor || v.color === selectedColor)
    ) ??
    // Before the shopper picks, fall back to any in-stock variant (not just
    // variants[0], which could itself be sold out) so the price + CTA reflect
    // something buyable.
    variants.find((v) => v.stock > 0) ??
    variants[0];

  const selectedOutOfStock = !!selectedVariant && selectedVariant.stock <= 0;

  const displayPrice = selectedVariant?.price ?? product.onlinePrice;
  const originalPrice = product.salePrice ?? product.mrp;
  const discountPct =
    displayPrice < originalPrice
      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
      : null;

  const addToBag = (buyNow: boolean) => {
    // Make the shopper pick when there's a real choice, so we never add the
    // wrong default variant silently.
    if (sizes.length > 0 && !selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (colors.length > 0 && !selectedColor) {
      toast.error("Please select a colour");
      return;
    }
    if (!selectedVariant || selectedVariant.stock <= 0) {
      toast.error("This option is out of stock");
      return;
    }

    const before =
      useCartStore.getState().items.find((i) => i.variantId === selectedVariant.id)?.quantity ?? 0;
    addToCart({
      variantId: selectedVariant.id,
      productId: product.id,
      name: product.name,
      variantLabel: [selectedVariant.color, selectedVariant.size].filter(Boolean).join(" / "),
      price: selectedVariant.price || product.onlinePrice,
      imageUrl: imageUrl ?? "",
      stock: selectedVariant.stock,
      isSpecial: discountPct !== null,
      mrp: discountPct !== null ? originalPrice : null,
    });
    // addItem bumps by 1; reconcile to the chosen quantity (capped at stock).
    const desired = Math.min(before + quantity, selectedVariant.stock);
    if (desired !== before + 1) updateQuantity(selectedVariant.id, desired);

    if (buyNow) {
      router.push("/checkout");
    } else {
      setCartOpen(true);
      toast.success("Added to bag");
    }
  };

  const stockBadge =
    product.stock === 0
      ? { label: "Out of Stock", color: "text-red-600", dot: "bg-red-500" }
      : product.stock <= 5
      ? { label: `Only ${product.stock} left`, color: "text-amber-600", dot: "bg-amber-500" }
      : { label: "In Stock", color: "text-green-600", dot: "bg-green-500" };

  return (
    <div className="space-y-6">
      {/* Category + Name */}
      <div>
        <p className="text-xs text-nate-grey-500 uppercase tracking-widest mb-2">
          {product.category}
        </p>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-serif leading-tight">{product.name}</h1>
          <button
            onClick={toggleWishlist}
            className="mt-1 shrink-0 p-2 rounded-full hover:bg-nate-grey-100 transition-colors"
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={20}
              className={`transition-colors ${
                wishlisted
                  ? "fill-pink-500 text-pink-500"
                  : "text-nate-grey-400 hover:text-pink-500"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span
          className={`text-2xl font-semibold ${
            discountPct !== null ? "price-special" : "text-nate-grey-800"
          }`}
        >
          ₹{displayPrice.toLocaleString("en-IN")}
        </span>
        {discountPct !== null && (
          <>
            <span className="text-base text-nate-grey-400 line-through">
              ₹{originalPrice.toLocaleString("en-IN")}
            </span>
            <span className="text-sm font-medium text-accent-highlight bg-accent-highlight/10 px-2 py-0.5 rounded-full">
              {discountPct}% OFF
            </span>
          </>
        )}
      </div>

      {/* Stock badge */}
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1.5 text-sm ${stockBadge.color}`}>
          <span className={`w-2 h-2 rounded-full ${stockBadge.dot}`} />
          {stockBadge.label}
        </span>
      </div>

      {/* Description */}
      {product.description && (
        <p className="text-nate-grey-600 leading-relaxed text-sm">
          {product.description}
        </p>
      )}

      {/* Size selector */}
      {sizes.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-nate-grey-800">Select Size</span>
            {selectedSize && (
              <span className="text-xs text-nate-grey-500 font-medium">{selectedSize}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const inStock = sizeInStock(size);
              const isSelected = selectedSize === size;
              return (
                <button
                  key={size}
                  onClick={() => inStock && setSelectedSize(size)}
                  disabled={!inStock}
                  title={inStock ? size : `${size} — out of stock`}
                  aria-label={inStock ? size : `${size}, out of stock`}
                  className={`
                    relative overflow-hidden px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200
                    ${isSelected
                      ? "bg-nate-grey-800 text-white border-nate-grey-800"
                      : inStock
                      ? "border-nate-grey-300 text-nate-grey-700 hover:border-nate-grey-800 hover:bg-nate-grey-50"
                      : "border-nate-grey-200 text-nate-grey-300 cursor-not-allowed"
                    }
                  `}
                >
                  {size}
                  {!inStock && (
                    // Diagonal "sold out" slash across the pill.
                    <span className="pointer-events-none absolute left-0 top-1/2 h-px w-[140%] -translate-y-1/2 -rotate-[18deg] origin-left bg-nate-grey-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color selector */}
      {colors.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-nate-grey-800">Select Color</span>
            {selectedColor && (
              <span className="text-xs text-nate-grey-500 font-medium">{selectedColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const inStock = colorInStock(color);
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  onClick={() => {
                    if (!inStock) return;
                    setSelectedColor(color);
                    onColorSelected?.(color);
                  }}
                  disabled={!inStock}
                  className={`
                    relative overflow-hidden min-w-[44px] px-4 py-2 rounded-full border text-sm font-medium capitalize transition-all duration-200
                    ${isSelected
                      ? "border-nate-grey-900 bg-nate-grey-900 text-white"
                      : inStock
                      ? "border-nate-grey-300 text-nate-grey-700 hover:border-nate-grey-800"
                      : "border-nate-grey-200 text-nate-grey-300 cursor-not-allowed"}
                  `}
                  title={inStock ? color : `${color} — out of stock`}
                  aria-label={inStock ? color : `${color}, out of stock`}
                >
                  {color.toLowerCase()}
                  {!inStock && (
                    <span className="pointer-events-none absolute left-0 top-1/2 h-px w-[140%] -translate-y-1/2 -rotate-[18deg] origin-left bg-nate-grey-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity + Add to Cart */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex items-center border border-nate-grey-300 rounded-full">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center text-nate-grey-600 hover:text-accent hover:bg-nate-grey-100 rounded-l-full transition-colors"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-12 text-center text-sm font-medium tabular-nums">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-10 h-10 flex items-center justify-center text-nate-grey-600 hover:text-accent hover:bg-nate-grey-100 rounded-r-full transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          onClick={() => addToBag(false)}
          disabled={product.stock === 0 || selectedOutOfStock}
          className="flex-1 bg-nate-grey-800 text-white py-3.5 rounded-full font-semibold text-sm tracking-wide hover:bg-nate-grey-700 active:scale-[0.98] transition-all disabled:bg-nate-grey-300 disabled:cursor-not-allowed"
        >
          {product.stock === 0
            ? "Out of Stock"
            : selectedOutOfStock
            ? "Selected option sold out"
            : "Add to Cart"}
        </button>
      </div>

      {/* Buy Now */}
      <button
        onClick={() => addToBag(true)}
        disabled={product.stock === 0 || selectedOutOfStock}
        className="w-full border-2 border-nate-grey-800 text-nate-grey-800 py-3.5 rounded-full font-semibold text-sm tracking-wide hover:bg-nate-grey-800 hover:text-white active:scale-[0.98] transition-all disabled:border-nate-grey-200 disabled:text-nate-grey-300 disabled:cursor-not-allowed"
      >
        Buy Now
      </button>

      {/* Benefits row */}
      <div className="border-t border-nate-grey-100 pt-5 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-nate-grey-500">Free Shipping</p>
          <p className="text-xs text-nate-grey-400 mt-0.5">On all orders</p>
        </div>
        <div>
          <p className="text-xs text-nate-grey-500">Easy Exchange</p>
          <p className="text-xs text-nate-grey-400 mt-0.5">7 days</p>
        </div>
        <div>
          <p className="text-xs text-nate-grey-500">Secure Payment</p>
          <p className="text-xs text-nate-grey-400 mt-0.5">100% safe</p>
        </div>
      </div>

      {/* SKU */}
      {product.sku && (
        <p className="text-xs text-nate-grey-400">SKU: {product.sku}</p>
      )}

      {/* Material & Care (hidden, handled by AccordionItem in page) */}
      {(material || care) && (
        <div className="sr-only">
          {material && <span>{material}</span>}
          {care && <span>{care}</span>}
        </div>
      )}
    </div>
  );
}

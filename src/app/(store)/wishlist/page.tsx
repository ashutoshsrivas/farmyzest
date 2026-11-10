"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, X, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { useWishlist } from "@/lib/wishlist";
import { useCartStore } from "@/lib/store";

// Wishlist page. Reads the localStorage-persisted wishlist store, so it works
// for guests and survives reloads. Each item links to its PDP; the heart on
// product cards / PDP toggles membership here.
export default function WishlistPage() {
  const items = useWishlist((s) => s.items);
  const remove = useWishlist((s) => s.remove);

  return (
    <div className="min-h-screen w-full px-6 md:px-12 lg:px-20 xl:px-24 py-12 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-6 h-6 text-grey-800" strokeWidth={1.5} />
        <h1 className="text-3xl font-serif text-grey-900">Wishlist</h1>
        <span className="text-sm text-grey-500">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <Heart className="w-12 h-12 text-grey-300 mb-5" strokeWidth={1} />
          <p className="font-serif text-grey-700 text-2xl mb-3">Your wishlist is empty</p>
          <p className="text-sm font-light text-grey-500 mb-8 max-w-xs">
            Tap the heart on any product to save it here for later.
          </p>
          <Link
            href="/shop"
            className="text-xs font-medium uppercase tracking-[0.15em] text-grey-900 border-b border-grey-900 pb-0.5 hover:text-grey-600 hover:border-grey-600 transition-colors"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {items.map((item) => (
            <WishlistCard key={item.productId} item={item} onRemove={() => remove(item.productId)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WishlistCard({
  item,
  onRemove,
}: {
  item: {
    productId: string;
    slug: string;
    name: string;
    price: number;
    imageUrl: string;
    categoryName?: string;
  };
  onRemove: () => void;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const setCartOpen = useCartStore((s) => s.setIsOpen);

  // Wishlist stores product-level data only (no variant). "Move to bag" sends
  // the shopper to the PDP to choose a size/colour rather than guessing.
  return (
    <div className="group relative">
      <button
        onClick={onRemove}
        aria-label="Remove from wishlist"
        className="absolute top-2.5 right-2.5 z-20 w-8 h-8 flex items-center justify-center bg-white/95 backdrop-blur-sm shadow-sm hover:bg-white rounded-full"
      >
        <X className="w-4 h-4 text-grey-700" strokeWidth={1.5} />
      </button>
      <Link href={`/shop/${item.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-grey-200">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              sizes="20vw"
            />
          ) : (
            <div className="w-full h-full bg-grey-200" />
          )}
        </div>
        <div className="mt-3 space-y-0.5">
          {item.categoryName && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-grey-500">
              {item.categoryName}
            </p>
          )}
          <h3 className="text-sm font-medium text-grey-800 line-clamp-1">{item.name}</h3>
          <p className="text-sm font-semibold text-grey-900 tabular-nums">
            ₹{item.price.toLocaleString("en-IN")}
          </p>
        </div>
      </Link>
      <Link
        href={`/shop/${item.slug}`}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-grey-700 hover:text-grey-900"
      >
        <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
        Move to bag
      </Link>
    </div>
  );
}

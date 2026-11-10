"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, ArrowRight } from "lucide-react";

// Lightweight product quick-view popped open from an order line (My Orders /
// admin order detail). Fetches the live product by slug and offers a jump to
// the full product page. Wrapping element is only clickable when a live slug is
// known (products deleted from the catalogue stay non-clickable).

interface QuickViewProps {
  slug: string;
  name?: string;
  image?: string;
  onClose: () => void;
}

function QuickViewModal({ slug, name, image, onClose }: QuickViewProps) {
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setProduct(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const images = (product?.images as { url: string }[] | undefined) ?? [];
  const img = images[0]?.url || image || "";
  const title = (product?.name as string) || name || "Product";
  const priceRaw = (product?.onlinePrice as number) ?? (product?.mrp as number) ?? null;
  const liveSlug = (product?.slug as string) || slug;
  const description = product?.description as string | undefined;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-xl overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-nate-grey-100 sticky top-0 bg-white">
          <span className="text-[11px] uppercase tracking-[0.15em] text-nate-grey-400">Quick view</span>
          <button onClick={onClose} aria-label="Close" className="text-nate-grey-400 hover:text-nate-grey-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="aspect-square w-full bg-nate-grey-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-nate-grey-300 text-sm">No image</span>
            )}
          </div>

          <h3 className="font-serif text-lg text-nate-grey-900">{title}</h3>
          {priceRaw != null && (
            <p className="text-base font-semibold text-nate-grey-900 mt-1">
              ₹{Number(priceRaw).toLocaleString("en-IN")}
            </p>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-nate-grey-400 text-sm mt-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && description && (
            <p className="text-sm text-nate-grey-500 mt-2 line-clamp-3">{description}</p>
          )}
          {!loading && !product && (
            <p className="text-sm text-nate-grey-400 mt-2">This product is no longer available in the catalogue.</p>
          )}

          <div className="mt-5 flex gap-3">
            {product?.slug ? (
              <Link
                href={`/shop/${liveSlug}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-nate-grey-900 text-white text-sm font-medium py-3 rounded-lg hover:bg-black transition-colors"
              >
                View product page <ArrowRight className="w-4 h-4" />
              </Link>
            ) : null}
            <button
              onClick={onClose}
              className="px-5 py-3 text-sm rounded-lg border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps order-line product content (image or name) so clicking it opens the
 * quick-view. Renders children unchanged (not clickable) when no slug is known.
 */
export function ProductPeek({
  slug,
  name,
  image,
  className,
  children,
}: {
  slug?: string | null;
  name?: string;
  image?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!slug) return <>{children}</>;
  return (
    <>
      <div
        className={className}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        title="Quick view"
        style={{ cursor: "pointer" }}
      >
        {children}
      </div>
      {open && <QuickViewModal slug={slug} name={name} image={image} onClose={() => setOpen(false)} />}
    </>
  );
}

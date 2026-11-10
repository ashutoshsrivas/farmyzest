// src/components/store/ProductGallery.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

interface GalleryImage {
  url: string;
  alt: string;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  // Optional controlled mode — when a parent (e.g. PDP wrapper) wants to
  // jump the gallery in response to color selection, it passes these in.
  // When omitted, the gallery manages its own active index internally.
  activeIndex?: number;
  onActiveIndexChange?: (idx: number) => void;
}

export function ProductGallery({
  images,
  activeIndex: controlledIndex,
  onActiveIndexChange,
}: ProductGalleryProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = controlledIndex ?? internalIndex;

  const setActiveIndex = (idx: number) => {
    if (onActiveIndexChange) onActiveIndexChange(idx);
    else setInternalIndex(idx);
  };

  const [zoomOpen, setZoomOpen] = useState(false);

  // Autoplay: cycle the main image every 2s. Pauses while the lightbox is open
  // or the shopper hovers the image (so they can study a frame), and never runs
  // for a single-image product.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (images.length < 2 || zoomOpen || paused) return;
    const id = setInterval(() => {
      setActiveIndex((activeIndex + 1) % images.length);
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, zoomOpen, paused, activeIndex]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false);
      if (e.key === "ArrowRight") setActiveIndex((activeIndex + 1) % images.length);
      if (e.key === "ArrowLeft")
        setActiveIndex((activeIndex - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomOpen, activeIndex, images.length]);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[3/4] bg-nate-grey-100 rounded-2xl flex items-center justify-center">
        <span className="text-nate-grey-400 text-sm">No image available</span>
      </div>
    );
  }

  const activeImage = images[activeIndex]!;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Main image — object-contain so we don't crop, padding via container.
            Click anywhere on the image to open the lightbox. */}
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-nate-grey-100 group cursor-zoom-in"
          aria-label="Open image at full size"
        >
          {/* object-top so the image hugs the top edge of the box, lining up
              with the product name in the right column instead of floating
              vertically-centred. Small symmetric padding keeps it off the
              rounded corners without re-introducing the centring gap. */}
          <div className="absolute inset-0 p-2 md:p-3">
            <div className="relative w-full h-full">
              <Image
                src={activeImage.url}
                alt={activeImage.alt}
                fill
                className="object-contain object-top transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={activeIndex === 0}
              />
            </div>
          </div>
          {/* Zoom-hint pill */}
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-nate-grey-700 text-xs font-medium px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="w-3 h-3" />
            Zoom
          </span>
        </button>

        {/* Thumbnails — also object-contain to match main image */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`relative shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 bg-nate-grey-50 ${
                  idx === activeIndex
                    ? "border-nate-grey-800"
                    : "border-transparent hover:border-nate-grey-300"
                }`}
                aria-label={`View image ${idx + 1}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt}
                  fill
                  className="object-contain p-1"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product image"
          onClick={() => setZoomOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomOpen(false);
            }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
            aria-label="Close zoom"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev / Next — only when multiple images */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((activeIndex - 1 + images.length) % images.length);
                }}
                className="absolute left-4 md:left-8 w-12 h-12 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((activeIndex + 1) % images.length);
                }}
                className="absolute right-4 md:right-8 w-12 h-12 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}

          {/* Image — preserve aspect ratio inside the viewport */}
          <div
            className="relative w-[92vw] h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImage.url}
              alt={activeImage.alt}
              fill
              className="object-contain"
              sizes="92vw"
              priority
            />
          </div>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
              {activeIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

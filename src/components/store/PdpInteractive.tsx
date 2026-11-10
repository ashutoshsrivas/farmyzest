"use client";

import { useState } from "react";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";

// Lifted state for the product detail page: the gallery and the info column
// need to talk to each other (picking a colour swatch should jump the gallery
// to that variant's photo). The server-rendered PDP page passes the resolved
// data here and we own the cross-component state.
//
// `colorImageMap` lets the server pre-compute "colour name → first image index
// whose alt or url best matches that colour" so the wrapper doesn't have to
// re-scan the image list on every click.

interface GalleryImage {
  url: string;
  alt: string;
}

interface Variant {
  id: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  price: number;
}

interface PdpInteractiveProps {
  images: GalleryImage[];
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
  /** Map of color name → image index to jump to when that color is selected. */
  colorImageMap?: Record<string, number>;
  /** Product slug — passed to ProductInfo for the wishlist entry. */
  slug?: string;
}

export function PdpInteractive({
  images,
  product,
  variants,
  material,
  care,
  colorImageMap,
  slug,
}: PdpInteractiveProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
      <ProductGallery
        images={images}
        activeIndex={activeImageIndex}
        onActiveIndexChange={setActiveImageIndex}
      />
      <ProductInfo
        product={product}
        variants={variants}
        material={material}
        care={care}
        slug={slug}
        imageUrl={images[0]?.url}
        onColorSelected={(color) => {
          if (!colorImageMap) return;
          const idx = colorImageMap[color];
          if (typeof idx === "number" && idx >= 0 && idx < images.length) {
            setActiveImageIndex(idx);
          }
        }}
      />
    </div>
  );
}

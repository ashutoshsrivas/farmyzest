import Image from "next/image";
import type { ImageSlotSpec } from "@/lib/home-content";

/**
 * A photo, or — until one is supplied — a clearly labelled placeholder that
 * states the intended shot. Never a stock photo standing in for a product.
 */
export function ImageSlot({
  slot,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  className = "",
}: {
  slot: ImageSlotSpec;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative w-full max-w-full overflow-hidden bg-sand ${className}`} style={{ aspectRatio: slot.ratio }}>
      {slot.src ? (
        <Image src={slot.src} alt={slot.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div
          role="img"
          aria-label={`Photo to come: ${slot.alt}`}
          className="absolute inset-0 flex flex-col justify-between p-4 bg-[repeating-linear-gradient(135deg,transparent_0_12px,color-mix(in_srgb,var(--color-seg)_12%,transparent)_12px_13px)]"
        >
          <span className="cat-label !text-[0.65rem] text-seg-ink">Photo to come · {slot.ratio.replace(/\s/g, "")}</span>
          <p className="max-w-[38ch] text-sm leading-snug text-stone">{slot.note}</p>
        </div>
      )}
    </div>
  );
}

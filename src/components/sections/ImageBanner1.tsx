import Link from "next/link";
import Image from "next/image";

// Simple full-width promo banner — a single image with optional overlay text
// and a CTA. Driven by the homepage builder's IMAGE_BANNER section.
type Props = {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
};

export function ImageBanner1({ imageUrl, title, subtitle, ctaText, ctaLink }: Props) {
  if (!imageUrl) return null;
  return (
    <section className="relative w-full h-[320px] md:h-[440px] overflow-hidden">
      <Image src={imageUrl} alt={title ?? ""} fill className="object-cover" />
      {(title || subtitle || ctaText) && (
        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-center text-white px-6">
          {title && <h2 className="text-3xl md:text-5xl font-serif mb-3">{title}</h2>}
          {subtitle && <p className="text-base md:text-lg text-white/90 mb-5 max-w-xl">{subtitle}</p>}
          {ctaText && ctaLink && (
            <Link
              href={ctaLink}
              className="inline-block bg-white text-nate-grey-900 px-7 py-3 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors"
            >
              {ctaText}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

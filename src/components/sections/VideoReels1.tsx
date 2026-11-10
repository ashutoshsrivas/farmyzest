"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { VideoReelItem } from "@/lib/home-sections";

// Autoplay vertical-video carousel (category reels) shown after the hero.
// Each reel is muted + looping (so browsers permit autoplay) and only plays
// while it's on screen, to keep things light. Content is admin-managed via the
// landing-page builder's VIDEO_REELS section.
export function VideoReels1({ title, items }: { title?: string; items: VideoReelItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reels = (items ?? []).filter((i) => i && i.videoUrl);

  // Play only the reels currently in view. (Hook runs unconditionally; the
  // empty-state early return below happens after all hooks.)
  useEffect(() => {
    const root = trackRef.current;
    if (!root) return;
    const vids = Array.from(root.querySelectorAll("video"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { root, threshold: 0.4 }
    );
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [reels.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 600), behavior: "smooth" });
  };

  if (reels.length === 0) return null;

  return (
    <section className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-8 md:py-10">
      {title && (
        <h2 className="text-center font-serif text-2xl md:text-3xl text-nate-grey-800 mb-6">
          {title}
        </h2>
      )}

      <div className="relative">
        {reels.length > 2 && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollBy(-1)}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-nate-grey-200 items-center justify-center text-nate-grey-700 hover:bg-nate-grey-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => scrollBy(1)}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-nate-grey-200 items-center justify-center text-nate-grey-700 hover:bg-nate-grey-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <div
          ref={trackRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {reels.map((reel, i) => {
            const card = (
              <div className="relative w-[150px] md:w-[230px] aspect-[3/5] flex-shrink-0 snap-start overflow-hidden rounded-xl bg-nate-grey-100 group">
                <video
                  src={reel.videoUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
                {reel.label && (
                  <>
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
                    <span className="absolute inset-x-0 bottom-3 text-center text-white text-xs md:text-sm font-medium uppercase tracking-wide px-2">
                      {reel.label}
                    </span>
                  </>
                )}
              </div>
            );
            return reel.href ? (
              <Link key={i} href={reel.href} className="contents">
                {card}
              </Link>
            ) : (
              <div key={i} className="contents">
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

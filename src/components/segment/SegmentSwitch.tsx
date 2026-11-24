"use client";

import { useSegment } from "./SegmentProvider";
import { SEGMENT_LABEL, type Segment } from "@/lib/segment";

const OPTIONS: Segment[] = ["garden", "farm"];

/** Two-way Garden | Farm toggle with a sliding pill. `full` stretches it to the container width. */
export function SegmentSwitch({ full = false, className = "" }: { full?: boolean; className?: string }) {
  const { segment, setSegment } = useSegment();
  const idx = OPTIONS.indexOf(segment);
  return (
    <div
      role="group"
      aria-label="Shopping for"
      className={`relative grid grid-cols-2 rounded-full border border-white/70 bg-white/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${full ? "w-full" : "w-[11.5rem]"} ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-seg-ink shadow-[0_4px_14px_-4px_rgba(31,46,34,0.45)] transition-transform duration-500 ease-[cubic-bezier(.3,1.4,.5,1)]"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      {OPTIONS.map((s) => {
        const active = s === segment;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => !active && setSegment(s)}
            className={`relative z-10 min-h-9 rounded-full px-4 text-sm font-semibold transition-colors duration-300 cursor-pointer ${
              active ? "text-bone" : "text-charcoal hover:text-seg-ink"
            }`}
          >
            {SEGMENT_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

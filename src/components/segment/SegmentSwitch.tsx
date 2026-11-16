"use client";

import { useSegment } from "./SegmentProvider";
import { SEGMENT_LABEL, type Segment } from "@/lib/segment";

const OPTIONS: Segment[] = ["garden", "farm"];

/** Two-way Garden | Farm toggle. `full` stretches it to the container width. */
export function SegmentSwitch({ full = false, className = "" }: { full?: boolean; className?: string }) {
  const { segment, setSegment } = useSegment();
  return (
    <div
      role="group"
      aria-label="Shopping for"
      className={`${full ? "flex w-full" : "inline-flex"} border border-charcoal/80 bg-bone ${className}`}
    >
      {OPTIONS.map((s) => {
        const active = s === segment;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => !active && setSegment(s)}
            className={`${full ? "flex-1" : ""} min-h-10 px-4 text-sm font-medium transition-colors duration-300 cursor-pointer ${
              active ? "bg-seg-ink text-bone" : "text-charcoal hover:bg-seg-tint"
            }`}
          >
            {SEGMENT_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

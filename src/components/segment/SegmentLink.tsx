"use client";

import Link from "next/link";
import { useSegment } from "./SegmentProvider";
import type { Segment } from "@/lib/segment";

/** A link that also switches the storefront to `segment` before navigating. */
export function SegmentLink({
  segment,
  href,
  className,
  children,
}: {
  segment: Segment;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { segment: current, setSegment } = useSegment();
  return (
    <Link href={href} className={className} onClick={() => current !== segment && setSegment(segment, { refresh: false })}>
      {children}
    </Link>
  );
}

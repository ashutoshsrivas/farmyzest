// Garden/Farm storefront segment — shared (client + server) definitions.
// The shopper's choice is stored in a cookie so the server renders the right
// accent and menus on first paint (no colour flash), and mirrored to
// localStorage as a fallback for browsers that drop the cookie.

export type Segment = "garden" | "farm";

export const SEGMENT_COOKIE = "fz_segment";
export const SEGMENT_STORAGE_KEY = "fz_segment";
export const DEFAULT_SEGMENT: Segment = "garden";

export function parseSegment(value: unknown): Segment {
  return value === "farm" ? "farm" : "garden";
}

/** Prisma enum value for a storefront segment. */
export function toDbSegment(s: Segment): "GARDEN" | "FARM" {
  return s === "farm" ? "FARM" : "GARDEN";
}

export const SEGMENT_LABEL: Record<Segment, string> = { garden: "Garden", farm: "Farm" };

/** Quick-menu entry for one segment (from Category.quickNav). */
export interface QuickNavItem {
  name: string;
  slug: string;
}

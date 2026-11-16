import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { parseSegment, SEGMENT_COOKIE, type QuickNavItem, type Segment } from "@/lib/segment";

/** The shopper's current segment, read from the cookie (garden by default). */
export async function getSegment(): Promise<Segment> {
  const jar = await cookies();
  return parseSegment(jar.get(SEGMENT_COOKIE)?.value);
}

/** Quick-menu categories for both segments, ordered as set in admin. */
export async function getQuickNav(): Promise<Record<Segment, QuickNavItem[]>> {
  const rows = await db.category.findMany({
    where: { quickNav: { not: null } },
    orderBy: [{ quickNavOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true, quickNav: true },
  });
  return {
    garden: rows.filter((r) => r.quickNav === "GARDEN").map(({ name, slug }) => ({ name, slug })),
    farm: rows.filter((r) => r.quickNav === "FARM").map(({ name, slug }) => ({ name, slug })),
  };
}

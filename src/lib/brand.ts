import { db } from "@/lib/db";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve a free-text brand name to a managed Brand row, creating it if new
 * (find-or-create, case-insensitive). Returns the brand id, or null for an
 * empty name. Lets the product form stay a simple text box while every product
 * still links to a real Brand entity (so brand-level discounts/caps apply).
 */
export async function resolveBrandId(name: string | null | undefined): Promise<string | null> {
  const clean = (name ?? "").trim();
  if (!clean) return null;

  const existing = await db.brand.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  // New brand — derive a unique slug.
  const base = slugify(clean) || "brand";
  let slug = base;
  let n = 1;
  while (await db.brand.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  const created = await db.brand.create({ data: { name: clean, slug }, select: { id: true } });
  return created.id;
}

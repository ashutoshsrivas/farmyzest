import { db } from "@/lib/db";

// Category browsing is hierarchical: selecting a category should surface the
// products filed directly under it AND the products of every subcategory
// beneath it — even when a product is tagged ONLY to the child. Given the
// selected slugs, this returns that set expanded with every descendant slug.
//
// Order/duplicates don't matter (the result feeds a Prisma `slug: { in: … }`).
export async function expandCategorySlugs(slugs: string[]): Promise<string[]> {
  if (!slugs.length) return slugs;

  const all = await db.category.findMany({
    select: { id: true, slug: true, parentId: true },
  });
  const bySlug = new Map(all.map((c) => [c.slug, c]));

  // Seed with the ids of the selected slugs that actually exist.
  const wantIds = new Set<string>();
  for (const s of slugs) {
    const c = bySlug.get(s);
    if (c) wantIds.add(c.id);
  }
  if (!wantIds.size) return slugs; // unknown slug(s) — leave untouched

  // Pull in children of anything already in the set until it stops growing.
  let added = true;
  while (added) {
    added = false;
    for (const c of all) {
      if (c.parentId && wantIds.has(c.parentId) && !wantIds.has(c.id)) {
        wantIds.add(c.id);
        added = true;
      }
    }
  }

  const out = new Set(slugs);
  for (const c of all) if (wantIds.has(c.id)) out.add(c.slug);
  return [...out];
}

// The mirror of the above for WRITES: given the category ids a product is being
// filed under, return that set expanded with every ANCESTOR id. So tagging a
// product to a subcategory ("Polos") also files it under the parent ("T-Shirts")
// — the product then genuinely belongs to the main category everywhere, not just
// on the storefront shop page (which tree-expands on read). Order/dupes don't
// matter — the result feeds a Prisma connect/set.
export async function withAncestorCategoryIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return ids;

  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(all.map((c) => [c.id, c.parentId]));

  const out = new Set(ids);
  for (const id of ids) {
    // Walk up the chain, guarding against cycles / missing links.
    let cur = parentOf.get(id) ?? null;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      out.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }
  return [...out];
}

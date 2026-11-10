export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isStoreBoardAuthed } from "@/lib/store-board-auth";
import { StoreBoardNav } from "../_components/StoreBoardNav";
import { ProductSearch } from "../_components/ProductSearch";

export default async function StoreBoardProducts() {
  if (!(await isStoreBoardAuthed())) redirect("/store-board/login");

  const [categories, brandRows, sizeRows, colorRows] = await Promise.all([
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    db.product.findMany({
      where: { brand: { not: null }, status: { not: "ARCHIVED" } },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
    db.productVariant.findMany({
      where: { size: { not: null }, product: { status: { not: "ARCHIVED" } } },
      distinct: ["size"],
      select: { size: true },
      orderBy: { size: "asc" },
    }),
    db.productVariant.findMany({
      where: { color: { not: null }, product: { status: { not: "ARCHIVED" } } },
      distinct: ["color"],
      select: { color: true },
      orderBy: { color: "asc" },
    }),
  ]);
  const brands = brandRows
    .map((b) => b.brand?.trim())
    .filter((b): b is string => !!b && !/^\d+$/.test(b));
  const sizes = sizeRows.map((s) => s.size?.trim()).filter((s): s is string => !!s);
  const colors = colorRows.map((c) => c.color?.trim()).filter((c): c is string => !!c);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-serif text-nate-grey-900 mb-4">Stock</h1>
      <ProductSearch categories={categories} brands={brands} sizes={sizes} colors={colors} />
      <StoreBoardNav />
    </div>
  );
}

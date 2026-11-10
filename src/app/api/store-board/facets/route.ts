export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isStoreBoardAuthed } from "@/lib/store-board-auth";

// Distinct sizes & colours available among non-archived products matching the
// selected category and/or brand. Lets the Size/Colour filters on the store
// board narrow to what actually exists in the current selection. Read-only.
export async function GET(req: NextRequest) {
  if (!(await isStoreBoardAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const productWhere: Prisma.ProductWhereInput[] = [{ status: { not: "ARCHIVED" } }];

  const category = sp.get("category");
  if (category) {
    productWhere.push({ OR: [{ category: { slug: category } }, { categories: { some: { slug: category } } }] });
  }
  const brand = sp.get("brand");
  if (brand) productWhere.push({ brand });

  const base: Prisma.ProductVariantWhereInput = { product: { AND: productWhere } };

  const [sizeRows, colorRows] = await Promise.all([
    db.productVariant.findMany({
      where: { ...base, size: { not: null } },
      distinct: ["size"],
      select: { size: true },
      orderBy: { size: "asc" },
    }),
    db.productVariant.findMany({
      where: { ...base, color: { not: null } },
      distinct: ["color"],
      select: { color: true },
      orderBy: { color: "asc" },
    }),
  ]);

  const sizes = sizeRows.map((s) => s.size?.trim()).filter((s): s is string => !!s);
  const colors = colorRows.map((c) => c.color?.trim()).filter((c): c is string => !!c);

  return NextResponse.json({ sizes, colors });
}

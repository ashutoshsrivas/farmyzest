export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isStoreBoardAuthed } from "@/lib/store-board-auth";

// Cookie-gated product/stock search for the store board. Read-only. Matches a
// query against product name/brand and variant sku/barcode, returns each
// product with its variants and live stock.
export async function GET(req: NextRequest) {
  if (!(await isStoreBoardAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sort = req.nextUrl.searchParams.get("sort") ?? "latest";
  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "name"
      ? { name: "asc" as const }
      : sort === "name-desc"
      ? { name: "desc" as const }
      : { createdAt: "desc" as const }; // latest (default)

  // ── Filters (same set as the admin product list) ─────────────────────────
  const sp = req.nextUrl.searchParams;
  const and: Prisma.ProductWhereInput[] = [{ status: { not: "ARCHIVED" } }];

  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        { variants: { some: { barcode: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  const category = sp.get("category");
  if (category) {
    and.push({ OR: [{ category: { slug: category } }, { categories: { some: { slug: category } } }] });
  }
  const brand = sp.get("brand");
  if (brand) and.push({ brand });
  const season = sp.get("season");
  if (season && ["ALL", "SUMMER", "WINTER"].includes(season)) {
    and.push({ season: season as Prisma.ProductWhereInput["season"] });
  }
  const gender = sp.get("gender");
  if (gender && ["MEN", "WOMEN", "UNISEX"].includes(gender)) {
    and.push({ gender: gender as Prisma.ProductWhereInput["gender"] });
  }
  // Size / colour — match a single variant carrying both when both are set, so
  // we don't surface a product that has the size in one colour and the colour
  // in a different variant.
  const size = sp.get("size");
  const color = sp.get("color");
  if (size || color) {
    and.push({
      variants: {
        some: {
          ...(size ? { size } : {}),
          ...(color ? { color } : {}),
        },
      },
    });
  }
  const stock = sp.get("stock");
  if (stock === "in") and.push({ variants: { some: { stock: { gt: 0 } } } });
  else if (stock === "out") and.push({ NOT: { variants: { some: { stock: { gt: 0 } } } } });
  else if (stock === "low") {
    const lowRows = await db.$queryRaw<{ productId: string }[]>`
      SELECT DISTINCT "productId" FROM "ProductVariant" WHERE stock > 0 AND stock <= "lowStockThreshold"
    `;
    and.push({ id: { in: lowRows.map((r) => r.productId) } });
  }

  const where: Prisma.ProductWhereInput = { AND: and };

  const products = await db.product.findMany({
    where,
    orderBy,
    take: 40,
    select: {
      id: true,
      name: true,
      brand: true,
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      variants: {
        orderBy: [{ color: "asc" }, { size: "asc" }],
        select: { id: true, sku: true, barcode: true, size: true, color: true, stock: true, lowStockThreshold: true },
      },
    },
  });

  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    imageUrl: p.images[0]?.url ?? null,
    totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      label: [v.color, v.size].filter(Boolean).join(" / ") || "Default",
      stock: v.stock,
      low: v.stock > 0 && v.stock <= v.lowStockThreshold,
    })),
  }));

  // Exact code hit (sku/barcode) — used to fire the out-of-stock voice alert.
  let exact: { productName: string; label: string; stock: number } | null = null;
  if (q) {
    const ql = q.toLowerCase();
    for (const p of result) {
      const v = p.variants.find((x) => x.sku.toLowerCase() === ql || x.barcode.toLowerCase() === ql);
      if (v) {
        exact = { productName: p.name, label: v.label, stock: v.stock };
        break;
      }
    }
  }

  return NextResponse.json({ products: result, exact });
}

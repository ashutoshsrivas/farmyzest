import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { syncLastPieceSpecial } from "@/lib/last-piece";

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      include: { _count: { select: { products: true } } },
    });

    const rootCategories = categories.filter((c) => !c.parentId);
    const categoryTree = rootCategories.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }));

    return NextResponse.json({ categories: categoryTree });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  // Shop mega-menu controls.
  showInMenu: z.boolean().optional(),
  menuHighlight: z.boolean().optional(),
  menuImageUrl: z.string().nullable().optional(),
  maxDiscountPct: z.number().min(0).max(100).nullable().optional(),
  // Channel-specific caps (tighten maxDiscountPct on that channel).
  maxOnlineDiscountPct: z.number().min(0).max(100).nullable().optional(),
  maxPosDiscountPct: z.number().min(0).max(100).nullable().optional(),
  // Flat ONLINE discount % applied to every product in this category on the storefront.
  discountPct: z.number().min(0).max(100).nullable().optional(),
  // Flat POS discount % applied to every product in this category at the counter.
  posDiscountPct: z.number().min(0).max(100).nullable().optional(),
  // Opt out of the last-piece auto-Special-Prices automation.
  excludeFromLastPiece: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const category = await db.category.create({ data: parsed.data });

    // A new category joins every existing collection (non-exclusive) so the
    // "all categories in all collections by default" invariant holds.
    const collections = await db.collection.findMany({ select: { id: true } });
    if (collections.length) {
      await db.collectionCategory.createMany({
        data: collections.map((c) => ({ collectionId: c.id, categoryId: category.id })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateCategorySchema = createCategorySchema.partial();

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return NextResponse.json({ error: "Category ID required" }, { status: 400 });

    const parsed = updateCategorySchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const category = await db.category.update({
      where: { id },
      data: parsed.data,
    });

    // If this category just OPTED OUT of the last-piece automation, immediately
    // pull any of its products that we auto-placed back out of Special Prices —
    // otherwise they'd linger there until their next stock movement.
    if (parsed.data.excludeFromLastPiece === true) {
      const affected = await db.product.findMany({
        where: {
          autoSpecialPrice: true,
          OR: [{ categoryId: id }, { categories: { some: { id } } }],
        },
        select: { id: true },
      });
      for (const p of affected) await syncLastPieceSpecial(db, p.id);
    }

    return NextResponse.json(category);
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Check if category has products or children
    const [productCount, childCount] = await Promise.all([
      db.product.count({ where: { categoryId: id } }),
      db.category.count({ where: { parentId: id } }),
    ]);

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${productCount} product(s) are assigned to this category` },
        { status: 409 }
      );
    }
    if (childCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete: this category has subcategories" },
        { status: 409 }
      );
    }

    await db.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
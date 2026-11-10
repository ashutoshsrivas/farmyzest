import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();

    const category = await db.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.parentId !== undefined && { parentId: body.parentId || null }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("PUT /api/categories/[id] error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE /api/categories/[id] — delete a category (or subcategory), moving its
// products somewhere safe first. `Product.categoryId` is a required FK, so a
// product can never be left without a category — it's either reassigned to a
// chosen target category or to a system "Uncategorised" bucket (auto-created).
//
// Body (JSON, optional):
//   { mode: "move", targetId: "<catId>" }  → move products into that category
//   { mode: "uncategorised" }              → move products into "Uncategorised"
// When the category has no products at all, no mode is needed.
//
// Any direct subcategories are moved up one level (to this category's parent),
// so they survive as independent categories the admin can manage separately.
// Cascade-scoped rows (CategoryProductOrder, CollectionCategory) are removed
// automatically by the schema's onDelete: Cascade.

const UNCAT_SLUG = "uncategorised";

async function ensureUncategorised() {
  const existing = await db.category.findFirst({ where: { slug: UNCAT_SLUG } });
  if (existing) return existing;
  return db.category.create({
    data: {
      name: "Uncategorised",
      slug: UNCAT_SLUG,
      showInMenu: false, // system bucket — keep it out of the storefront menu
      sortOrder: 9999,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;

    const category = await db.category.findUnique({ where: { id } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    // How many products touch this category (primary FK and/or m2m tag)?
    const [primaryCount, taggedCount] = await Promise.all([
      db.product.count({ where: { categoryId: id } }),
      db.product.count({ where: { categories: { some: { id } } } }),
    ]);
    const hasProducts = primaryCount > 0 || taggedCount > 0;

    // Parse the (optional) reassignment instruction.
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const mode = body?.mode as "move" | "uncategorised" | undefined;
    const targetId = typeof body?.targetId === "string" ? body.targetId : undefined;

    // Resolve where products should go (only needed when products exist).
    let destId: string | null = null;
    if (hasProducts) {
      if (mode === "move") {
        if (!targetId) return NextResponse.json({ error: "Pick a category to move the products into." }, { status: 400 });
        if (targetId === id) return NextResponse.json({ error: "Can't move products into the category being deleted." }, { status: 400 });
        const target = await db.category.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!target) return NextResponse.json({ error: "Target category not found." }, { status: 400 });
        destId = target.id;
      } else if (mode === "uncategorised") {
        const uncat = await ensureUncategorised();
        if (uncat.id === id) {
          return NextResponse.json({ error: "This IS the Uncategorised category — move its products to another category first." }, { status: 400 });
        }
        destId = uncat.id;
      } else {
        // No instruction given but products exist — tell the client to ask.
        return NextResponse.json(
          { error: "This category has products. Choose where to move them.", needsReassign: true, primaryCount, taggedCount },
          { status: 409 }
        );
      }
    }

    let movedProducts = 0;
    let reparentedChildren = 0;

    await db.$transaction(async (tx) => {
      if (hasProducts && destId) {
        // Every product that references this category, by FK or by m2m tag.
        const affected = await tx.product.findMany({
          where: { OR: [{ categoryId: id }, { categories: { some: { id } } }] },
          select: { id: true },
        });
        movedProducts = affected.length;

        // Re-point the primary FK for products whose primary was this category.
        await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: destId } });

        // Tag all affected products with the destination (idempotent). The old
        // m2m link to this category is dropped automatically when it's deleted.
        if (affected.length > 0) {
          await tx.category.update({
            where: { id: destId },
            data: { taggedProducts: { connect: affected.map((p) => ({ id: p.id })) } },
          });
        }
      }

      // Move direct subcategories up to this category's parent level.
      const childRes = await tx.category.updateMany({
        where: { parentId: id },
        data: { parentId: category.parentId },
      });
      reparentedChildren = childRes.count;

      await tx.category.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, movedProducts, reparentedChildren });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/admin/products/bulk
//
// Bulk-set product location (STORE / GODOWN), website visibility
// (showOnWebsite), and/or move a selection into a category — the dropdowns in
// the admin products black bar. Each field is OPTIONAL: a field that's omitted
// is left unchanged. Location and visibility only affect the storefront; POS
// and admin always show every product.

const bodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Select at least one product"),
    location: z.enum(["STORE", "GODOWN"]).optional(),
    showOnWebsite: z.boolean().optional(),
    // Move the selection into this category (the primary category id).
    categoryId: z.string().min(1).optional(),
  })
  .refine(
    (b) =>
      b.location !== undefined ||
      b.showOnWebsite !== undefined ||
      b.categoryId !== undefined,
    { message: "Choose a location, visibility, or category to apply" }
  );

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { ids, location, showOnWebsite, categoryId } = parsed.data;

  // Only write the fields that were actually chosen, so unset fields stay as-is.
  const data: { location?: "STORE" | "GODOWN"; showOnWebsite?: boolean } = {};
  if (location !== undefined) data.location = location;
  if (showOnWebsite !== undefined) data.showOnWebsite = showOnWebsite;

  try {
    if (categoryId !== undefined) {
      // Moving into a category rewrites the many-to-many `categories` set as
      // well as the scalar `categoryId`, and `updateMany` can't touch the m2m
      // relation — so do it per-product in a transaction. We set the primary
      // category (the /shop URL + breadcrumb) and REPLACE the whole m2m set
      // with just the target, so a moved product appears ONLY under its new
      // category — a clean move, not an extra tag.
      const cat = await db.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!cat) {
        return NextResponse.json({ error: "Category not found" }, { status: 400 });
      }

      await db.$transaction(
        ids.map((id) =>
          db.product.update({
            where: { id },
            data: {
              ...data,
              categoryId,
              categories: { set: [{ id: categoryId }] },
            },
          })
        )
      );
      return NextResponse.json({ success: true, updated: ids.length });
    }

    const res = await db.product.updateMany({
      where: { id: { in: ids } },
      data,
    });
    return NextResponse.json({ success: true, updated: res.count });
  } catch (err) {
    console.error("[products bulk]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/bulk  body: { ids: string[] }
//
// Hard-deletes the selected products. Their variants, images, reviews, and
// collection links cascade away (FKs are onDelete: Cascade). Order history is
// SAFE — OrderItem stores denormalised snapshots (productName, sku, price) and
// has no foreign key to Product, so past orders keep their record intact.
const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one product"),
});

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const res = await db.product.deleteMany({ where: { id: { in: parsed.data.ids } } });
    return NextResponse.json({ success: true, deleted: res.count });
  } catch (err) {
    console.error("[products bulk delete]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

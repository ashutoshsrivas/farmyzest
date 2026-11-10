import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = req.nextUrl;
  const admin = searchParams.get("admin") === "true";

  try {
    if (admin && session?.user?.role === "ADMIN") {
      // Admin: full list with category memberships (+ exclusive flags).
      const collections = await db.collection.findMany({
        orderBy: [{ rankOnHome: "desc" }, { sortOrder: "asc" }],
        include: {
          categories: { select: { categoryId: true, exclusive: true } },
          _count: { select: { products: true, categories: true } },
        },
      });
      return NextResponse.json({ collections });
    }

    // Public: only active collections with product previews
    const collections = await db.collection.findMany({
      where: { isActive: true },
      orderBy: [{ rankOnHome: "desc" }, { sortOrder: "asc" }],
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
          take: 8,
        },
        _count: { select: { products: true } },
      },
    });
    return NextResponse.json({ collections });
  } catch (error) {
    console.error("GET /api/collections error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const baseSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(["SUMMER", "WINTER", "SEASONAL", "CUSTOM"]),
  isActive: z.boolean().default(true),
  rankOnHome: z.boolean().default(false), // = show on homepage
  showInHeader: z.boolean().default(false),
  showInFooter: z.boolean().default(false),
  bannerUrl: z.string().optional(),
  sortOrder: z.number().int().default(0),
  // Category membership. `categoryIds` are the categories in this collection
  // (omitted on create ⇒ all categories). `exclusiveCategoryIds` is the subset
  // that should be exclusive to this collection.
  categoryIds: z.array(z.string()).optional(),
  exclusiveCategoryIds: z.array(z.string()).optional(),
});

/**
 * Reconcile a collection's category memberships in a transaction:
 *  • drop memberships not in `memberIds`
 *  • upsert each member with its exclusive flag
 *  • exclusivity invariant — an exclusive category belongs to ONLY this
 *    collection, so remove its memberships from every other collection
 */
async function reconcileMemberships(
  tx: Prisma.TransactionClient,
  collectionId: string,
  memberIds: string[],
  exclusiveIds: string[]
) {
  await tx.collectionCategory.deleteMany({
    where: { collectionId, categoryId: { notIn: memberIds } },
  });
  for (const categoryId of memberIds) {
    const exclusive = exclusiveIds.includes(categoryId);
    await tx.collectionCategory.upsert({
      where: { collectionId_categoryId: { collectionId, categoryId } },
      create: { collectionId, categoryId, exclusive },
      update: { exclusive },
    });
    if (exclusive) {
      await tx.collectionCategory.deleteMany({
        where: { categoryId, collectionId: { not: collectionId } },
      });
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = baseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { categoryIds, exclusiveCategoryIds, ...data } = parsed.data;

    // Default: every category is in the new collection.
    const allCatIds = (
      await db.category.findMany({ select: { id: true } })
    ).map((c) => c.id);
    const memberIds = categoryIds ?? allCatIds;
    const exclusiveIds = (exclusiveCategoryIds ?? []).filter((id) => memberIds.includes(id));

    const collection = await db.$transaction(async (tx) => {
      const created = await tx.collection.create({ data });
      await reconcileMemberships(tx, created.id, memberIds, exclusiveIds);
      return created;
    });
    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    console.error("POST /api/collections error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateSchema = baseSchema.partial();

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: "Collection ID required" }, { status: 400 });

    const parsed = updateSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { categoryIds, exclusiveCategoryIds, ...data } = parsed.data;

    const collection = await db.$transaction(async (tx) => {
      const updated = await tx.collection.update({ where: { id }, data });
      // Only touch memberships when categoryIds was sent.
      if (categoryIds) {
        const exclusiveIds = (exclusiveCategoryIds ?? []).filter((cid) =>
          categoryIds.includes(cid)
        );
        await reconcileMemberships(tx, id, categoryIds, exclusiveIds);
      }
      return updated;
    });
    return NextResponse.json(collection);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    console.error("PUT /api/collections error:", error);
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

    await db.collection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Persist a freshly-uploaded image to a product the moment it lands in S3,
// rather than waiting for the whole product form to be saved. Without this an
// upload that never makes it into a Save payload (form reloaded/closed first,
// or Save clicked mid-upload) leaves the S3 object orphaned and unreferenced.
// Admin-only. Idempotent on url.

const schema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  color: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const product = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Already attached → return it (idempotent; safe to call more than once).
  const existing = await db.productImage.findFirst({
    where: { productId: id, url: parsed.data.url },
  });
  if (existing) return NextResponse.json({ image: existing });

  const count = await db.productImage.count({ where: { productId: id } });
  const image = await db.productImage.create({
    data: {
      productId: id,
      url: parsed.data.url,
      alt: parsed.data.alt ?? null,
      color: parsed.data.color || null,
      sortOrder: count,
      isPrimary: count === 0,
    },
  });
  return NextResponse.json({ image });
}

// Explicit removal of a single image. Since the product Save no longer deletes
// images, this is the ONLY way an image leaves a product — the admin removing
// it on purpose. DELETE /api/admin/products/[id]/images?url=<url>  (or ?imageId=)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const url = req.nextUrl.searchParams.get("url");
  const imageId = req.nextUrl.searchParams.get("imageId");
  if (!url && !imageId) {
    return NextResponse.json({ error: "url or imageId required" }, { status: 400 });
  }

  const removed = await db.productImage.deleteMany({
    where: { productId: id, ...(imageId ? { id: imageId } : { url: url! }) },
  });

  // Keep exactly one primary: if we removed it, promote the new first image.
  const remaining = await db.productImage.findMany({
    where: { productId: id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, isPrimary: true },
  });
  if (remaining.length && !remaining.some((im) => im.isPrimary)) {
    await db.productImage.update({ where: { id: remaining[0]!.id }, data: { isPrimary: true } });
  }

  return NextResponse.json({ removed: removed.count });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/admin/products/[id]
// Lightweight partial updates for the products list (website visibility
// toggle, manual sort position). Full edits still go through the form's PUT
// on /api/admin/products.

const patchSchema = z.object({
  showOnWebsite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const product = await db.product.update({
      where: { id },
      data: parsed.data,
      select: { id: true, showOnWebsite: true, sortOrder: true },
    });
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    console.error("[admin products PATCH]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

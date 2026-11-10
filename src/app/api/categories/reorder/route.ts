import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// POST /api/categories/reorder  { ids: string[] }
//
// Persists the display order of categories by stamping each id's sortOrder to
// its index in the array. Used by the Navigation admin's "Shop dropdown" card;
// the storefront mega-menu and shop filters order top-level categories by
// sortOrder, so this reorders the live menu.

const schema = z.object({ ids: z.array(z.string().min(1)).min(1) });

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  try {
    await db.$transaction(
      parsed.data.ids.map((id, i) =>
        db.category.update({ where: { id }, data: { sortOrder: i } })
      )
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/categories/reorder error:", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }
}

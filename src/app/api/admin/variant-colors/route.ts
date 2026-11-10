import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Distinct colour names already used across all variants — for autocomplete in
// the product form so admins reuse existing colours instead of re-typing.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.productVariant.findMany({
    where: { color: { not: null } },
    distinct: ["color"],
    select: { color: true },
    orderBy: { color: "asc" },
  });
  const colors = rows.map((r) => r.color?.trim()).filter((c): c is string => !!c);
  return NextResponse.json({ colors });
}

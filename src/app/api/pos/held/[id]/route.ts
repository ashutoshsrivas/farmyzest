export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// DELETE /api/pos/held/[id] — remove a parked bill. Called both when a held bill
// is retrieved (consumed back into the cart) and when it's discarded. Idempotent:
// a missing row is treated as already gone.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  await db.heldBill.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/pos/sessions/[id]/close
//
// Closes a POS session by stamping `endTime` to now. Today's running totals
// (sales / cash / gateway / orderCount) are kept as-is — they were accumulated
// transactionally on every sale by /api/pos/orders. There's no "settle" step
// the cashier needs to perform here; closing simply marks the session as
// completed so the daily register report can scope to closed-only sessions.
//
// Idempotent: closing an already-closed session is a no-op (returns the row).

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Session id required" }, { status: 400 });

  try {
    const existing = await db.posSession.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (existing.endTime) {
      // Already closed — return current state, no error.
      return NextResponse.json({ success: true, session: existing, alreadyClosed: true });
    }

    const updated = await db.posSession.update({
      where: { id },
      data: { endTime: new Date() },
    });

    return NextResponse.json({ success: true, session: updated });
  } catch (err) {
    console.error("[POS sessions/close] Error:", err);
    return NextResponse.json({ error: "Failed to close session" }, { status: 500 });
  }
}

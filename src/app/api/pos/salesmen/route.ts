import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POS-staff-only: the response includes commissionRate which is sensitive
// business data. The POS UI is itself guarded by (pos)/layout, so callers
// always carry a session cookie by the time they hit this endpoint.
const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

export async function GET() {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const salesmen = await db.salesman.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        commissionRate: true,
      },
    });
    return NextResponse.json({ salesmen });
  } catch (error) {
    console.error("GET /api/pos/salesmen error:", error);
    return NextResponse.json({ error: "Failed to fetch salesmen" }, { status: 500 });
  }
}

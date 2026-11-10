export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// The most recent POS bill — powers the sidebar "Last Bill" + reprint.
export async function GET() {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const last = await db.order.findFirst({
    where: { source: "POS" },
    orderBy: { createdAt: "desc" },
    select: { id: true, posOrderNum: true, total: true, createdAt: true },
  });

  if (!last) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    orderId: last.id,
    orderNumber: last.posOrderNum ?? last.id.slice(-8).toUpperCase(),
    total: last.total,
    date: last.createdAt.toISOString(),
  });
}

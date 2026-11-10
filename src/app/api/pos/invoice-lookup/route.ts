export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// Find a bill by its POS number (or order id tail) so the counter can reprint
// a past invoice — Vasy's "Scan Sales Invoice".
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const num = (req.nextUrl.searchParams.get("num") ?? "").trim();
  if (!num) return NextResponse.json({ found: false });

  const order = await db.order.findFirst({
    where: {
      OR: [
        { posOrderNum: { equals: num, mode: "insensitive" } },
        { id: { endsWith: num.toLowerCase() } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, posOrderNum: true, total: true },
  });

  if (!order) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    orderId: order.id,
    orderNumber: order.posOrderNum ?? order.id.slice(-8).toUpperCase(),
    total: order.total,
  });
}

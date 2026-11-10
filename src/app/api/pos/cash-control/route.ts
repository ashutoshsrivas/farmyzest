export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

async function posUser() {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) return null;
  return session;
}

// GET — current drawer state since the last OPEN: opening float, cash movements,
// cash sales collected, and the expected cash in the drawer.
export async function GET() {
  if (!(await posUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lastOpen = await db.cashMovement.findFirst({
    where: { type: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  const since = lastOpen?.createdAt ?? new Date(Date.now() - 86400000);

  const [movements, cashAgg] = await Promise.all([
    db.cashMovement.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.order.aggregate({
      where: { source: "POS", createdAt: { gte: since }, status: { notIn: ["CANCELLED", "RETURNED"] } },
      _sum: { paidCash: true },
    }),
  ]);

  const opening = lastOpen?.amount ?? 0;
  const cashIn = movements.filter((m) => m.type === "IN").reduce((s, m) => s + m.amount, 0);
  const cashOut = movements.filter((m) => m.type === "OUT").reduce((s, m) => s + m.amount, 0);
  const cashSales = cashAgg._sum.paidCash ?? 0;
  const expected = opening + cashIn + cashSales - cashOut;

  return NextResponse.json({
    openedAt: lastOpen?.createdAt.toISOString() ?? null,
    opening,
    cashIn,
    cashOut,
    cashSales,
    expected,
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      amount: m.amount,
      note: m.note,
      at: m.createdAt.toISOString(),
    })),
  });
}

const postSchema = z.object({
  type: z.enum(["OPEN", "IN", "OUT", "CLOSE"]),
  amount: z.number().nonnegative(),
  note: z.string().trim().max(200).optional().nullable(),
});

// POST — record a drawer movement.
export async function POST(req: NextRequest) {
  const session = await posUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const m = await db.cashMovement.create({
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      note: parsed.data.note?.trim() || null,
      createdByUserId: session.user.id,
    },
  });
  return NextResponse.json({ success: true, id: m.id });
}

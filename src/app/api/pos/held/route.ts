export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// GET /api/pos/held — list parked bills, newest first. Held bills live in the DB
// (not the browser) so they survive a tab close and show on every counter.
export async function GET() {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bills = await db.heldBill.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Shape each row back into the client's HeldBill: hoist the cart snapshot out
  // of `payload` and expose it as `items` (+ savedAt) so the modal renders as-is.
  const out = bills.map((b) => {
    const payload = (b.payload ?? {}) as Record<string, unknown>;
    return {
      id: b.id,
      billNumber: b.billNumber,
      salesmanId: b.salesmanId ?? "",
      salesmanName: b.salesmanName,
      customerName: b.customerName ?? "",
      customerPhone: b.customerPhone ?? "",
      subtotal: b.subtotal,
      taxAmount: b.taxAmount,
      total: b.total,
      items: Array.isArray(payload.items) ? payload.items : [],
      payload,
      savedAt: b.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ bills: out });
}

const holdSchema = z.object({
  billNumber: z.string().min(1).max(64),
  salesmanId: z.string().optional().nullable(),
  salesmanName: z.string().min(1).max(120),
  customerName: z.string().max(120).optional().nullable(),
  customerPhone: z.string().max(20).optional().nullable(),
  subtotal: z.number().default(0),
  taxAmount: z.number().default(0),
  total: z.number().default(0),
  itemCount: z.number().int().default(0),
  // Full POS cart snapshot (items + customer + discounts + charges + notes).
  payload: z.record(z.string(), z.any()),
});

// POST /api/pos/held — park the current bill.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = holdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid held bill" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const bill = await db.heldBill.create({
    data: {
      billNumber: d.billNumber,
      salesmanId: d.salesmanId || null,
      salesmanName: d.salesmanName,
      customerName: d.customerName || null,
      customerPhone: d.customerPhone || null,
      subtotal: d.subtotal,
      taxAmount: d.taxAmount,
      total: d.total,
      itemCount: d.itemCount,
      payload: d.payload as Prisma.InputJsonValue,
      heldById: session.user.id ?? null,
    },
  });

  return NextResponse.json({ id: bill.id, billNumber: bill.billNumber }, { status: 201 });
}

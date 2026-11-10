import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function admin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const createSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "UPI", "BANK", "OTHER"]).default("CASH"),
  reference: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  // ISO date (yyyy-mm-dd) or full ISO; defaults to now.
  paidAt: z.string().optional(),
});

// Record a commission/incentive payout (partial allowed).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const salesman = await db.salesman.findUnique({ where: { id }, select: { id: true } });
  if (!salesman) return NextResponse.json({ error: "Salesman not found" }, { status: 404 });

  const { amount, method, reference, note, paidAt } = parsed.data;
  const when = paidAt ? new Date(paidAt) : new Date();
  if (isNaN(when.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const payment = await db.salesmanPayment.create({
    data: {
      salesmanId: id,
      amount,
      method,
      reference: reference?.trim() || null,
      note: note?.trim() || null,
      paidAt: when,
      createdByUserId: session.user.id,
    },
  });
  return NextResponse.json({ success: true, payment }, { status: 201 });
}

// Remove a payout (correction). ?paymentId=...
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  // Scope the delete to this salesman so an id can't be used to delete elsewhere.
  const res = await db.salesmanPayment.deleteMany({ where: { id: paymentId, salesmanId: id } });
  if (res.count === 0) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

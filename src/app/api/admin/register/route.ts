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
  kind: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().positive("Amount must be greater than 0"),
  note: z.string().trim().min(1, "Add a note").max(300),
  category: z.string().trim().max(80).optional().nullable(),
  paymentMethod: z.string().trim().max(40).optional().nullable(),
  entryDate: z.string().optional(), // yyyy-mm-dd or ISO; defaults to now
});

// Add a register entry (money in / out). Standalone — affects nothing else.
export async function POST(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const { kind, amount, note, category, paymentMethod, entryDate } = parsed.data;
  // Record an IST-day-tagged entry: when only a yyyy-mm-dd is given, anchor it
  // to noon IST so it always falls on that calendar day in IST (the register
  // buckets by IST day, and the server runs in UTC).
  const when = entryDate
    ? /^\d{4}-\d{2}-\d{2}$/.test(entryDate)
      ? new Date(`${entryDate}T12:00:00.000+05:30`)
      : new Date(entryDate)
    : new Date();
  if (isNaN(when.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const entry = await db.registerEntry.create({
    data: {
      kind,
      amount,
      note,
      category: category?.trim() || null,
      paymentMethod: paymentMethod?.trim() || null,
      entryDate: when,
      createdByUserId: session.user.id,
    },
  });
  return NextResponse.json({ success: true, entry }, { status: 201 });
}

// Delete an entry. ?id=...
export async function DELETE(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await db.registerEntry.deleteMany({ where: { id } });
  if (res.count === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

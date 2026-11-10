export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

async function admin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

// GET ?year=YYYY&month=M (1-12) → { dates: string[] } absent days that month.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") ?? "", 10);
  const month = parseInt(sp.get("month") ?? "", 10); // 1-12
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // first of next month
  const rows = await db.salesmanAbsence.findMany({
    where: { salesmanId: id, date: { gte: start, lt: end } },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ dates: rows.map((r) => r.date.toISOString().slice(0, 10)) });
}

const postSchema = z.object({
  dates: z.array(z.string().regex(DATE_RE)).min(1, "Pick at least one date"),
  absent: z.boolean(),
});

// POST { dates, absent } → mark this salesman absent (absent=true) or present
// (absent=false) on each of the given days. Future dates allowed.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const exists = await db.salesman.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Salesman not found" }, { status: 404 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { absent } = parsed.data;
  const ds = [...new Set(parsed.data.dates)].map(toDate);

  if (absent) {
    await db.salesmanAbsence.createMany({
      data: ds.map((date) => ({ salesmanId: id, date, createdByUserId: session.user.id })),
      skipDuplicates: true,
    });
  } else {
    await db.salesmanAbsence.deleteMany({ where: { salesmanId: id, date: { in: ds } } });
  }

  return NextResponse.json({ success: true, count: ds.length });
}

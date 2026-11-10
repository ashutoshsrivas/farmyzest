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
// Store as a pure date at UTC midnight (column is @db.Date).
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

// GET ?date=yyyy-mm-dd → { date, absentIds } — who's marked absent that day.
export async function GET(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const rows = await db.salesmanAbsence.findMany({
    where: { date: toDate(date) },
    select: { salesmanId: true },
  });
  return NextResponse.json({ date, absentIds: rows.map((r) => r.salesmanId) });
}

const postSchema = z.object({
  date: z.string().regex(DATE_RE),
  absentIds: z.array(z.string()).default([]),
});

// POST { date, absentIds } → reconcile that day to EXACTLY this absent set.
// Everyone not listed is present (their row, if any, is removed). Only absences
// are persisted.
export async function POST(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { date, absentIds } = parsed.data;
  const d = toDate(date);
  const ids = [...new Set(absentIds)];

  // Reconcile this day to exactly `ids`: remove anyone now present, add the
  // absent ones. When nobody is absent, clear the whole day.
  await db.$transaction([
    db.salesmanAbsence.deleteMany({
      where: { date: d, ...(ids.length ? { salesmanId: { notIn: ids } } : {}) },
    }),
    ...ids.map((id) =>
      db.salesmanAbsence.upsert({
        where: { salesmanId_date: { salesmanId: id, date: d } },
        create: { salesmanId: id, date: d, createdByUserId: session.user.id },
        update: {},
      })
    ),
  ]);

  return NextResponse.json({ success: true, absent: ids.length });
}

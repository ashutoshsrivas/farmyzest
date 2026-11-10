import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Default navbar links — seeded the first time the table is empty so the
// editor opens on the current header.
const DEFAULTS = [
  { label: "Summer", href: "/shop?collection=summer" },
  { label: "Winter", href: "/shop?collection=winter" },
  { label: "About", href: "/about" },
];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return false;
  return true;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let links = await db.navLink.findMany({ orderBy: { sortOrder: "asc" } });
  if (links.length === 0) {
    await db.navLink.createMany({
      data: DEFAULTS.map((l, i) => ({ ...l, sortOrder: i })),
    });
    links = await db.navLink.findMany({ orderBy: { sortOrder: "asc" } });
  }
  return NextResponse.json({ links });
}

const createSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(300),
  newTab: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const agg = await db.navLink.aggregate({ _max: { sortOrder: true } });
  const link = await db.navLink.create({
    data: { ...parsed.data, sortOrder: (agg._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ link }, { status: 201 });
}

const updateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60).optional(),
  href: z.string().min(1).max(300).optional(),
  newTab: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  try {
    const link = await db.navLink.update({ where: { id }, data });
    return NextResponse.json({ link });
  } catch {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await db.navLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
}

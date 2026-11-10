import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_SECTIONS, SECTION_META, type HomeSectionType } from "@/lib/home-sections";

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

const TYPES = Object.keys(SECTION_META) as HomeSectionType[];

// GET — list sections in order. Auto-seeds the current default layout the first
// time the table is empty, so the builder always opens on the live design.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sections = await db.homeSection.findMany({ orderBy: { sortOrder: "asc" } });
  if (sections.length === 0) {
    await db.homeSection.createMany({
      data: DEFAULT_SECTIONS.map((s, i) => ({
        type: s.type,
        config: asJson(s.config),
        sortOrder: i,
        enabled: true,
      })),
    });
    sections = await db.homeSection.findMany({ orderBy: { sortOrder: "asc" } });
  }
  return NextResponse.json({ sections });
}

const createSchema = z.object({
  type: z.enum(TYPES as [HomeSectionType, ...HomeSectionType[]]),
  config: z.record(z.string(), z.unknown()).optional(),
});

// POST — add a new section at the bottom.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  const agg = await db.homeSection.aggregate({ _max: { sortOrder: true } });
  const section = await db.homeSection.create({
    data: {
      type: parsed.data.type,
      config: asJson(parsed.data.config ?? SECTION_META[parsed.data.type].defaultConfig),
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ section }, { status: 201 });
}

const updateSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// PUT — toggle enabled and/or replace config.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  try {
    const section = await db.homeSection.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.config !== undefined ? { config: asJson(data.config) } : {}),
      },
    });
    return NextResponse.json({ section });
  } catch {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await db.homeSection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
}

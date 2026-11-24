import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Admin CRUD for the homepage "Shop by need" cards.

async function requireAdmin() {
  const session = await auth();
  return !!session?.user && session.user.role === "ADMIN";
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Internal links ("/shop?…") or full http(s) URLs only.
const href = z
  .string()
  .trim()
  .min(1, "Link is required")
  .max(400)
  .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Link must start with / or http(s)://");
const imageUrl = z
  .string()
  .trim()
  .max(600)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//i.test(v), "Image must be an https:// URL or a /path")
  .transform((v) => (v === "" ? null : v));

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(60),
  body: z.string().trim().max(120).default(""),
  href,
  imageUrl: imageUrl.optional().nullable(),
  enabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  const needs = await db.shopNeed.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ needs });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const agg = await db.shopNeed.aggregate({ _max: { sortOrder: true } });
  const need = await db.shopNeed.create({
    data: { ...parsed.data, imageUrl: parsed.data.imageUrl ?? null, sortOrder: (agg._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ need }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  try {
    const need = await db.shopNeed.update({ where: { id }, data });
    return NextResponse.json({ need });
  } catch {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await db.shopNeed.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
}

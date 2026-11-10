import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

async function isAdmin() {
  const s = await auth();
  return !!s?.user && s.user.role === "ADMIN";
}

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
} as const;

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resellers = await db.user.findMany({
    where: { role: "RESELLER" },
    select: SELECT,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ resellers });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const password = await bcrypt.hash(d.password, 10);
    const user = await db.user.create({
      data: {
        name: d.name,
        email: d.email.toLowerCase(),
        phone: d.phone || null,
        password,
        role: "RESELLER",
      },
      select: SELECT,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    console.error("POST /api/admin/resellers", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
});

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, isActive, password } = parsed.data;
  // Only ever touch RESELLER accounts from this endpoint.
  const existing = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!existing || existing.role !== "RESELLER") {
    return NextResponse.json({ error: "Reseller not found" }, { status: 404 });
  }
  const data: { isActive?: boolean; password?: string } = {};
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.password = await bcrypt.hash(password, 10);
  const user = await db.user.update({ where: { id }, data, select: SELECT });
  return NextResponse.json(user);
}

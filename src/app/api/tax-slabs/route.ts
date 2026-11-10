// src/app/api/tax-slabs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  // GET is admin-scoped: every caller in the codebase is an admin page
  // (admin/products/new, admin/products/[id], admin/taxes). Tax configuration
  // is internal business data and shouldn't be enumerable by anonymous clients.
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const slabs = await db.taxSlab.findMany({
      orderBy: { percentage: "asc" },
    });
    return NextResponse.json(slabs);
  } catch (error) {
    console.error("GET /api/tax-slabs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  percentage: z.number().min(0).max(100),
  minAmount: z.number().min(0).optional().nullable(),
  maxAmount: z.number().min(0).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const slab = await db.taxSlab.create({ data: parsed.data });
    return NextResponse.json(slab, { status: 201 });
  } catch (error) {
    console.error("POST /api/tax-slabs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1).optional(),
  percentage: z.number().min(0).max(100).optional(),
  minAmount: z.number().min(0).optional().nullable(),
  maxAmount: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { id, ...data } = parsed.data;
    const slab = await db.taxSlab.update({ where: { id }, data });
    return NextResponse.json(slab);
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Tax slab not found" }, { status: 404 });
    }
    console.error("PUT /api/tax-slabs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID query parameter is required" }, { status: 400 });

    await db.taxSlab.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Tax slab not found" }, { status: 404 });
    }
    console.error("DELETE /api/tax-slabs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
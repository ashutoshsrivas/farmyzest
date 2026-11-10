import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const salesmen = await db.salesman.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { orders: true } },
      },
    });

    return NextResponse.json({ salesmen });
  } catch (error) {
    console.error("GET /api/admin/salesmen error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const createSalesmanSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  commissionRate: z.number().min(0).max(100).default(0),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createSalesmanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const salesman = await db.salesman.create({ data: parsed.data });
    return NextResponse.json(salesman, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/salesmen error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateSalesmanSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  commissionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = updateSalesmanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { id, ...data } = parsed.data;
    const salesman = await db.salesman.update({
      where: { id },
      data,
    });
    return NextResponse.json(salesman);
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Soft-deactivate instead of hard delete
    await db.salesman.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Salesman roster is admin-only. The POS UI uses /api/pos/salesmen which has
// its own role check; this admin endpoint must not leak commission rates etc.

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const salesmen = await db.salesman.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(salesmen);
  } catch {
    return NextResponse.json({ error: "Failed to fetch salesmen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, phone, email, commissionRate, isActive } = body;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const salesman = await db.salesman.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        commissionRate: commissionRate || 0,
        isActive: isActive ?? true,
      },
    });
    return NextResponse.json(salesman, { status: 201 });
  } catch (error) {
    console.error("POST /api/salesmen error:", error);
    return NextResponse.json({ error: "Failed to create salesman" }, { status: 500 });
  }
}

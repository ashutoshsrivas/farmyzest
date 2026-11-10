import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Suppliers are private business data — admin only on both GET and POST.

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(suppliers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, phone, email, address, gstin } = body;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const supplier = await db.supplier.create({
      data: { name, phone: phone || null, email: email || null, address: address || null, gstin: gstin || null },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("POST /api/suppliers error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}

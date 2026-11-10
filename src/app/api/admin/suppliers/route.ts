import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { bills: true } },
      },
    });
    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error("GET /api/admin/suppliers error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // Handle nested POST /payments route
    if (body.billId && body.amount !== undefined) {
      const paymentSchema = z.object({
        billId: z.string(),
        amount: z.number().positive(),
        method: z.string().min(1),
        reference: z.string().optional(),
      });
      const parsed = paymentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }

      const payment = await db.supplierPayment.create({
        data: {
          billId: parsed.data.billId,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference || null,
        },
      });

      // Update supplier balance
      await db.supplier.update({
        where: { id: (await db.supplierBill.findUnique({ where: { id: parsed.data.billId } }))!.supplierId },
        data: { balance: { decrement: parsed.data.amount } },
      });

      return NextResponse.json(payment, { status: 201 });
    }

    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supplier = await db.supplier.create({ data: parsed.data });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/suppliers error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const updateSupplierSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  isActive: z.boolean().optional(),
  balance: z.number().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = updateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { id, ...data } = parsed.data;
    const supplier = await db.supplier.update({
      where: { id },
      data,
    });
    return NextResponse.json(supplier);
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
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

    // Soft-deactivate
    await db.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
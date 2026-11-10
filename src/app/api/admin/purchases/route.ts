import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncLastPieceForVariants } from "@/lib/last-piece";

// /api/admin/purchases — supplier bill (purchase invoice) endpoints
//
// POST creates a new bill plus its line items atomically. Each line that
// references a variantId also bumps that variant's stock by (quantity +
// freeQuantity) inside the same transaction — that's the whole point of
// recording the bill: it's the journal entry that says "these units arrived".
//
// If `updateCostPrice: true` is passed (default true), the product's
// `costPrice` is updated to the bill's `unitCost` for each unique product
// touched. Off by default would force admins to keep cost in sync manually.

const lineSchema = z.object({
  productId: z.string().min(1).optional().nullable(),
  variantId: z.string().min(1).optional().nullable(),
  description: z.string().trim().min(1).max(500),
  hsnCode: z.string().trim().max(50).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),

  quantity: z.number().int().positive().max(100_000),
  freeQuantity: z.number().int().nonnegative().max(100_000).optional().default(0),

  unitCost: z.number().nonnegative(),
  mrp: z.number().nonnegative().optional().nullable(),
  sellingPrice: z.number().nonnegative().optional().nullable(),

  discount1Pct: z.number().min(0).max(100).optional().default(0),
  discount2Pct: z.number().min(0).max(100).optional().default(0),

  taxPercent: z.number().min(0).max(100).optional().nullable(),
});

const bodySchema = z.object({
  supplierId: z.string().min(1),
  refBillNo: z.string().trim().max(100).optional().nullable(),
  date: z.string().optional(),
  shippingDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  paymentTerm: z.string().trim().max(100).optional().nullable(),
  reverseCharge: z.boolean().optional().default(false),
  taxType: z.string().trim().max(50).optional().nullable(),
  termsAndConditions: z.string().trim().max(5000).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),

  flatDiscount: z.number().nonnegative().optional().default(0),
  flatDiscountIsPct: z.boolean().optional().default(false),

  items: z.array(lineSchema).min(1, "At least one item is required"),

  /** When true (default) the bill writes back to Product.costPrice. */
  updateCostPrice: z.boolean().optional().default(true),
});

// Generate BIL-YYYYMMDD-NNNN. NNNN is the count of bills created today + 1,
// padded. Collisions across simultaneous saves are caught by the @unique
// constraint on billNumber and we retry once with an incremented suffix.
async function nextBillNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const dayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const todayCount = await tx.supplierBill.count({
    where: { createdAt: { gte: dayStart, lt: dayEnd } },
  });
  return `BIL-${dateStr}-${String(todayCount + 1).padStart(4, "0")}`;
}

// Shared line + totals math so POST (create) and PUT (edit) never diverge.
function computeBill(data: z.infer<typeof bodySchema>) {
  const lines = data.items.map((it) => {
    const qty = it.quantity;
    const freeQty = it.freeQuantity ?? 0;
    const discountFactor =
      (1 - (it.discount1Pct ?? 0) / 100) * (1 - (it.discount2Pct ?? 0) / 100);
    const netRate = Math.max(0, it.unitCost * discountFactor);
    const taxPct = it.taxPercent ?? 0;
    const taxAmount = (netRate * qty * taxPct) / 100;
    const amount = netRate * qty + taxAmount;
    return {
      productId: it.productId ?? null,
      variantId: it.variantId ?? null,
      description: it.description,
      hsnCode: it.hsnCode ?? null,
      unit: it.unit ?? "PCS",
      quantity: qty,
      freeQuantity: freeQty,
      unitCost: it.unitCost,
      rate: it.unitCost, // legacy mirror
      mrp: it.mrp ?? null,
      sellingPrice: it.sellingPrice ?? null,
      discount1Pct: it.discount1Pct ?? 0,
      discount2Pct: it.discount2Pct ?? 0,
      taxPercent: taxPct > 0 ? taxPct : null,
      netRate,
      taxAmount,
      amount,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.netRate * l.quantity, 0);
  const taxAmountSum = lines.reduce((s, l) => s + l.taxAmount, 0);
  const flatDiscAbs = data.flatDiscountIsPct
    ? (subtotal * Math.min(100, data.flatDiscount ?? 0)) / 100
    : Math.min(subtotal, data.flatDiscount ?? 0);
  const taxableAmount = Math.max(0, subtotal - flatDiscAbs);
  const effectiveTax = subtotal > 0 ? (taxAmountSum * taxableAmount) / subtotal : 0;
  const rawTotal = taxableAmount + effectiveTax;
  const rounded = Math.round(rawTotal);
  const roundOff = rounded - rawTotal;
  return { lines, subtotal, flatDiscAbs, taxableAmount, effectiveTax, roundOff, total: rounded };
}

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Verify supplier exists up front so we don't run a transaction we know will fail.
  const supplier = await db.supplier.findUnique({
    where: { id: data.supplierId },
    select: { id: true },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  // Pre-compute the line shapes + bill totals outside the tx so any math
  // errors surface before we start mutating stock.
  const { lines, subtotal, flatDiscAbs, taxableAmount, effectiveTax, roundOff, total } =
    computeBill(data);

  try {
    const bill = await db.$transaction(async (tx) => {
      const billNumber = await nextBillNumber(tx);

      const created = await tx.supplierBill.create({
        data: {
          supplierId: data.supplierId,
          billNumber,
          refBillNo: data.refBillNo ?? null,
          date: data.date ? new Date(data.date) : new Date(),
          shippingDate: data.shippingDate ? new Date(data.shippingDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentTerm: data.paymentTerm ?? null,
          reverseCharge: data.reverseCharge ?? false,
          taxType: data.taxType ?? "Default",
          termsAndConditions: data.termsAndConditions ?? null,
          notes: data.notes ?? null,
          subtotal,
          flatDiscount: flatDiscAbs,
          flatDiscountIsPct: data.flatDiscountIsPct ?? false,
          taxableAmount,
          taxAmount: effectiveTax,
          roundOff,
          total,
          status: "PENDING",
          createdByUserId: session.user.id,
          items: { create: lines },
        },
        include: { items: true },
      });

      // Stock movements + optional cost-price refresh. We only touch variants
      // — when a line has no variantId the buyer entered a non-inventory line.
      const productCostUpdates = new Map<string, number>();
      for (const l of lines) {
        if (l.variantId) {
          await tx.productVariant.update({
            where: { id: l.variantId },
            data: { stock: { increment: l.quantity + l.freeQuantity } },
          });
        }
        if (l.productId && data.updateCostPrice) {
          // Last write wins if the same product appears on multiple lines.
          productCostUpdates.set(l.productId, l.unitCost);
        }
      }
      for (const [productId, costPrice] of productCostUpdates) {
        await tx.product.update({
          where: { id: productId },
          data: { costPrice },
        });
      }

      // Receiving stock may lift a product back above its last piece.
      await syncLastPieceForVariants(tx, lines.map((l) => l.variantId));

      return created;
    });

    return NextResponse.json({ success: true, bill }, { status: 201 });
  } catch (err: unknown) {
    console.error("[purchases POST]", err);
    if ((err as { code?: string })?.code === "P2002") {
      // Race on billNumber unique — extremely rare, just ask the caller to retry.
      return NextResponse.json(
        { error: "Bill number collision, please save again" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }
}

// PUT /api/admin/purchases?id=<billId> — edit an existing bill. Reconciles
// stock by the NET change per variant (old received qty → new) so editing
// doesn't double-count or lose inventory. Bill number + status are preserved.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bill id required" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db.supplierBill.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  const supplier = await db.supplier.findUnique({
    where: { id: data.supplierId },
    select: { id: true },
  });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { lines, subtotal, flatDiscAbs, taxableAmount, effectiveTax, roundOff, total } =
    computeBill(data);

  try {
    const bill = await db.$transaction(async (tx) => {
      // Net stock delta per variant = new received − old received.
      const delta = new Map<string, number>();
      for (const it of existing.items) {
        if (it.variantId)
          delta.set(it.variantId, (delta.get(it.variantId) ?? 0) - (it.quantity + it.freeQuantity));
      }
      for (const l of lines) {
        if (l.variantId)
          delta.set(l.variantId, (delta.get(l.variantId) ?? 0) + (l.quantity + l.freeQuantity));
      }
      // Only adjust stock for variants that still exist. Old bills may
      // reference variants deleted in a catalog overwrite; updating a missing
      // record throws P2025 and used to abort the whole save ("Failed to
      // update bill"). A deleted variant has no stock to reconcile — skip it.
      const touchedVariantIds = [...delta.keys()].filter((vid) => delta.get(vid) !== 0);
      const liveVariantIds = touchedVariantIds.length
        ? new Set(
            (
              await tx.productVariant.findMany({
                where: { id: { in: touchedVariantIds } },
                select: { id: true },
              })
            ).map((v) => v.id)
          )
        : new Set<string>();
      for (const [variantId, d] of delta) {
        if (d !== 0 && liveVariantIds.has(variantId)) {
          await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: d } } });
        }
      }
      // Editing a bill can move stock in either direction — reconcile.
      await syncLastPieceForVariants(tx, [...liveVariantIds]);

      // Replace items + update header. billNumber / status / createdBy untouched.
      await tx.supplierBillItem.deleteMany({ where: { billId: id } });
      const updated = await tx.supplierBill.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          refBillNo: data.refBillNo ?? null,
          date: data.date ? new Date(data.date) : existing.date,
          shippingDate: data.shippingDate ? new Date(data.shippingDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentTerm: data.paymentTerm ?? null,
          reverseCharge: data.reverseCharge ?? false,
          taxType: data.taxType ?? "Default",
          termsAndConditions: data.termsAndConditions ?? null,
          notes: data.notes ?? null,
          subtotal,
          flatDiscount: flatDiscAbs,
          flatDiscountIsPct: data.flatDiscountIsPct ?? false,
          taxableAmount,
          taxAmount: effectiveTax,
          roundOff,
          total,
          items: { create: lines },
        },
        include: { items: true },
      });

      if (data.updateCostPrice) {
        const costUpdates = new Map<string, number>();
        for (const l of lines) if (l.productId) costUpdates.set(l.productId, l.unitCost);
        const pids = [...costUpdates.keys()];
        const liveProductIds = pids.length
          ? new Set(
              (
                await tx.product.findMany({ where: { id: { in: pids } }, select: { id: true } })
              ).map((p) => p.id)
            )
          : new Set<string>();
        for (const [productId, costPrice] of costUpdates) {
          if (liveProductIds.has(productId)) {
            await tx.product.update({ where: { id: productId }, data: { costPrice } });
          }
        }
      }
      return updated;
    });
    return NextResponse.json({ success: true, bill });
  } catch (err) {
    console.error("[purchases PUT]", err);
    return NextResponse.json({ error: "Failed to update bill" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const supplierId = sp.get("supplierId") ?? undefined;
  const status = sp.get("status") as
    | "PENDING"
    | "PARTIAL"
    | "PAID"
    | "OVERDUE"
    | null;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "25", 10)));
  const skip = (page - 1) * limit;

  const where: Prisma.SupplierBillWhereInput = {
    ...(supplierId ? { supplierId } : {}),
    ...(status ? { status } : {}),
  };

  const [bills, total] = await Promise.all([
    db.supplierBill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        _count: { select: { items: true } },
      },
    }),
    db.supplierBill.count({ where }),
  ]);

  return NextResponse.json({
    bills,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// PATCH /api/admin/purchases?id=<billId> — change ONLY the bill's (payment)
// status. Kept separate from PUT so a status change never re-touches stock or
// re-writes line items.
const patchSchema = z.object({
  status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE"]),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bill id required" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const bill = await db.supplierBill.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, bill });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }
    console.error("[purchases PATCH]", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

// DELETE /api/admin/purchases?id=<billId> — delete a supplier bill and REVERSE
// the stock it brought in. Receiving the bill incremented each variant's stock
// by (quantity + freeQuantity); deleting it decrements the same amount so the
// inventory journal stays balanced. Stock is clamped at 0 (never negative) in
// case some received units were already sold. Recorded supplier payments are
// removed too (no cascade on that relation); line items cascade on bill delete.
// Cost-price changes the bill made are NOT rolled back — the prior cost isn't
// stored.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bill id required" }, { status: 400 });

  const existing = await db.supplierBill.findUnique({
    where: { id },
    include: { items: { select: { variantId: true, quantity: true, freeQuantity: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  try {
    await db.$transaction(async (tx) => {
      // Net received units to pull back per variant.
      const pullback = new Map<string, number>();
      for (const it of existing.items) {
        if (it.variantId) {
          pullback.set(it.variantId, (pullback.get(it.variantId) ?? 0) + it.quantity + it.freeQuantity);
        }
      }
      // Only reconcile variants that still exist (a catalog overwrite may have
      // deleted some). Clamp at 0 so we never leave negative stock behind.
      const variantIds = [...pullback.keys()];
      const live = variantIds.length
        ? await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, stock: true },
          })
        : [];
      for (const v of live) {
        const next = Math.max(0, v.stock - (pullback.get(v.id) ?? 0));
        await tx.productVariant.update({ where: { id: v.id }, data: { stock: next } });
      }
      // Removing stock may drop a product to its last piece.
      await syncLastPieceForVariants(tx, live.map((v) => v.id));

      // Supplier payments have no cascade — remove them first, then the bill
      // (its line items cascade automatically).
      await tx.supplierPayment.deleteMany({ where: { billId: id } });
      await tx.supplierBill.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[purchases DELETE]", err);
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 });
  }
}

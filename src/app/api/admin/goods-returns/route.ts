import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncLastPieceForVariants } from "@/lib/last-piece";
import { z } from "zod";

async function adminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind = kindParam === "CUSTOMER" || kindParam === "SUPPLIER" ? kindParam : undefined;
  const returns = await db.goodsReturn.findMany({
    where: kind ? { kind } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true, supplier: { select: { name: true } } },
  });
  return NextResponse.json({ returns });
}

const schema = z.object({
  kind: z.enum(["CUSTOMER", "SUPPLIER"]).default("CUSTOMER"),
  supplierId: z.string().min(1).optional().nullable(),
  note: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive().max(1000),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { kind, supplierId, note, items } = parsed.data;

  // For supplier returns, validate the supplier exists (if one was chosen).
  if (kind === "SUPPLIER" && supplierId) {
    const supplier = await db.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 400 });
  }

  // Collapse duplicate variant rows into a single quantity.
  const merged = new Map<string, number>();
  for (const it of items) merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.quantity);
  const variantIds = [...merged.keys()];

  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { select: { name: true } } },
  });
  if (variants.length !== variantIds.length) {
    return NextResponse.json({ error: "One or more items no longer exist" }, { status: 400 });
  }
  const vmap = new Map(variants.map((v) => [v.id, v]));

  // Supplier returns remove stock — refuse if any line exceeds what's on hand.
  if (kind === "SUPPLIER") {
    const short = variants.find((v) => merged.get(v.id)! > v.stock);
    if (short) {
      return NextResponse.json(
        { error: `Not enough stock for ${short.product.name} (${short.sku}): ${short.stock} on hand` },
        { status: 400 }
      );
    }
  }

  try {
    // Atomic: create the return record + adjust every variant's stock together.
    // CUSTOMER returns add stock back; SUPPLIER returns take it away.
    const created = await db.$transaction(async (tx) => {
      const gr = await tx.goodsReturn.create({
        data: {
          kind,
          supplierId: kind === "SUPPLIER" ? supplierId || null : null,
          note: note || null,
          createdByUserId: session.user.id,
          items: {
            create: variantIds.map((vid) => {
              const v = vmap.get(vid)!;
              return {
                variantId: vid,
                productName: v.product.name,
                sku: v.sku,
                quantity: merged.get(vid)!,
              };
            }),
          },
        },
        include: { items: true },
      });
      for (const vid of variantIds) {
        const qty = merged.get(vid)!;
        await tx.productVariant.update({
          where: { id: vid },
          data: { stock: kind === "SUPPLIER" ? { decrement: qty } : { increment: qty } },
        });
      }
      await syncLastPieceForVariants(tx, variantIds);
      return gr;
    });
    return NextResponse.json({ success: true, return: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/goods-returns error:", error);
    return NextResponse.json({ error: "Failed to record return" }, { status: 500 });
  }
}

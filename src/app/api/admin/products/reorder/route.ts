import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scopeMembershipWhere, type Scope } from "@/lib/product-order";

// POST /api/admin/products/reorder
// Pin products to the top/bottom of an order. Higher sortOrder floats up.
//
//  • No scope  → GLOBAL order (Product.sortOrder) — the main shop.
//  • scope = { category|collection, id } → order WITHIN that category /
//    collection only (CategoryProductOrder / CollectionProductOrder), leaving
//    the global order — and every other context — untouched.
//
// Within a scope a product's effective order is its scope row's sortOrder,
// falling back to the global sortOrder. "top" assigns the selected products
// above the current max effective; "bottom" below the current min.

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  position: z.enum(["top", "bottom"]),
  scope: z
    .object({ type: z.enum(["category", "collection"]), id: z.string().min(1) })
    .optional()
    .nullable(),
});

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { ids, position, scope } = parsed.data;

  try {
    // ── Global ordering (main shop + admin list) ───────────────────────────
    // Freshness model: the list is ordered by createdAt desc, so a brand-new
    // product sits on top. "Move to top" re-stamps createdAt to NOW, so the item
    // jumps to the top just like a fresh arrival — and any product added later
    // naturally sorts ABOVE it. "Move to bottom" stamps it below the current
    // oldest. Multiple picks are staggered by 1ms to keep their relative order.
    if (!scope) {
      if (position === "top") {
        const now = Date.now();
        await db.$transaction(
          ids.map((id, i) =>
            db.product.update({ where: { id }, data: { createdAt: new Date(now - i) } })
          )
        );
      } else {
        const oldest = await db.product.aggregate({ _min: { createdAt: true } });
        const base = (oldest._min.createdAt ?? new Date()).getTime();
        await db.$transaction(
          ids.map((id, i) =>
            db.product.update({ where: { id }, data: { createdAt: new Date(base - (i + 1)) } })
          )
        );
      }
      return NextResponse.json({ success: true, updated: ids.length, scope: "global" });
    }

    // ── Scoped ordering (within one category / collection) ─────────────────
    // Positions live on the SAME epoch-second scale as createdAt (see
    // product-order.ts). "top" stamps just above NOW, so the product floats to
    // the top of the scope and stays there until a genuinely NEWER product is
    // added (matching the global freshness model). "bottom" stamps below the
    // scope's current oldest position.
    const sc = scope as Scope;
    const nowSec = Math.floor(Date.now() / 1000);
    const select =
      sc.type === "category"
        ? {
            createdAt: true,
            categoryOrders: { where: { categoryId: sc.id }, select: { sortOrder: true } },
          }
        : {
            createdAt: true,
            collectionOrders: { where: { collectionId: sc.id }, select: { sortOrder: true } },
          };
    const rows = (await db.product.findMany({
      where: scopeMembershipWhere(sc),
      select: select as never,
    })) as {
      createdAt: Date;
      categoryOrders?: { sortOrder: number }[];
      collectionOrders?: { sortOrder: number }[];
    }[];
    const eff = (r: (typeof rows)[number]) =>
      (sc.type === "category" ? r.categoryOrders?.[0]?.sortOrder : r.collectionOrders?.[0]?.sortOrder) ??
      Math.floor(new Date(r.createdAt).getTime() / 1000);
    const effs = rows.map(eff);
    const min = effs.length ? Math.min(...effs) : nowSec;

    await db.$transaction(
      ids.map((productId, i) => {
        const sortOrder = position === "top" ? nowSec + ids.length - i : min - 1 - i;
        if (sc.type === "category") {
          return db.categoryProductOrder.upsert({
            where: { categoryId_productId: { categoryId: sc.id, productId } },
            create: { categoryId: sc.id, productId, sortOrder },
            update: { sortOrder },
          });
        }
        return db.collectionProductOrder.upsert({
          where: { collectionId_productId: { collectionId: sc.id, productId } },
          create: { collectionId: sc.id, productId, sortOrder },
          update: { sortOrder },
        });
      })
    );

    return NextResponse.json({ success: true, updated: ids.length, scope: sc.type });
  } catch (err) {
    console.error("[admin products reorder]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

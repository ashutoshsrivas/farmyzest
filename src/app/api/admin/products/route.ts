import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { allocateVariantCodes } from "@/lib/sku";
import { syncLastPieceSpecial } from "@/lib/last-piece";
import { withAncestorCategoryIds } from "@/lib/category-tree";
import { resolveBrandId } from "@/lib/brand";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");

  // Single-product fetch (used by the edit form): return ALL images, ordered,
  // so the editor shows every image — not just the primary. The list view only
  // needs the primary thumbnail, so it stays lean (take: 1) below.
  if (id) {
    const product = await db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        variants: true,
        category: true,
        categories: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json({ products: product ? [product] : [] });
  }

  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      variants: true,
      category: true,
      categories: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({ products });
}

const createProductSchema = z.object({
  name: z.string().min(1),
  // Optional: a fast purchase/stock-in entry omits it and we derive a unique
  // slug from the name server-side (see POST). The full editor still sends one.
  slug: z.string().optional(),
  description: z.string().optional(),
  // Primary category (canonical). Optional when categoryIds is provided — the
  // first id there becomes primary.
  categoryId: z.string().optional(),
  // All categories the product belongs to. The first is the primary.
  categoryIds: z.array(z.string()).optional(),
  mrp: z.number().positive(),
  salePrice: z.number().optional(),
  sellingPrice: z.number().optional(),
  // Optional: defaults to MRP when omitted (quick stock-in). Must be positive
  // when provided.
  onlinePrice: z.number().positive().optional(),
  /** Pre-GST cost per unit (drives gross margin reporting). */
  costPrice: z.number().nonnegative().optional(),
  /** Wholesale price shown to RESELLER accounts. null = no special reseller price. */
  resellerPrice: z.number().nonnegative().nullable().optional(),
  /** Cap on coupon discount % for this product. null/absent = uncapped; 0 = none. */
  maxDiscountPct: z.number().min(0).max(100).nullable().optional(),
  taxSlabId: z.string().optional(),
  brand: z.string().optional(),
  tags: z.array(z.string()).optional(),
  season: z.enum(["SUMMER", "WINTER", "ALL"]).default("ALL"),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).default("UNISEX"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  showOnWebsite: z.boolean().optional(),
  material: z.string().optional(),
  careInstructions: z.string().optional(),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
    color: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  // sku/barcode are NOT accepted from the client anymore — they're assigned
  // server-side as sequential SS-N codes (see src/lib/sku.ts). Any sku/barcode
  // sent by older clients is ignored.
  variants: z.array(z.object({
    size: z.string().optional(),
    color: z.string().optional(),
    colorHex: z.string().optional(),
    priceOverride: z.number().optional(),
    mrp: z.number().optional(),
    costPrice: z.number().optional(),
    stock: z.number().int().min(0).default(0),
    incentiveType: z.enum(["PERCENT", "AMOUNT"]).optional(),
    incentiveValue: z.number().nonnegative().optional(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const { images, variants, categoryId, categoryIds, ...productData } = parsed.data;

    // Resolve the category set: primary = first of categoryIds, else categoryId.
    // The full connect-set always includes the primary, so the m2m mirrors
    // every category the product belongs to.
    const allIds = Array.from(new Set([...(categoryIds ?? []), ...(categoryId ? [categoryId] : [])]));
    const primaryId = categoryIds?.[0] ?? categoryId;
    if (!primaryId) {
      return NextResponse.json({ error: "At least one category is required" }, { status: 400 });
    }
    // Tagging a subcategory files the product under its parent(s) too, so it
    // shows under the main category everywhere (not just the tree-expanding shop).
    const connectIds = await withAncestorCategoryIds(allIds);

    // Link the free-text brand to a managed Brand row (find-or-create) so
    // brand-level discounts / caps apply.
    const brandId = await resolveBrandId(productData.brand);

    // Quick purchase/stock-in entries omit slug + online price. Derive a UNIQUE
    // slug from the name (append -2, -3… on collision) and fall back to MRP for
    // the online price, so only Name/Cost/MRP/Brand/Category are truly required.
    const slugify = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    let slug = productData.slug?.trim() || "";
    if (!slug) {
      const base = slugify(productData.name) || "product";
      slug = base;
      let n = 1;
      // Bounded lookup loop — the unique index is still the ultimate guard.
      while (await db.product.findUnique({ where: { slug }, select: { id: true } })) {
        n += 1;
        slug = `${base}-${n}`;
      }
    }
    const onlinePrice = productData.onlinePrice ?? productData.mrp;

    // Resolve taxSlabId to a real id or null so an empty/unknown value can't
    // violate the FK ("" is sent for "No tax").
    let resolvedTaxSlabId: string | null = null;
    if (productData.taxSlabId) {
      const ts = await db.taxSlab.findUnique({ where: { id: productData.taxSlabId }, select: { id: true } });
      resolvedTaxSlabId = ts ? ts.id : null;
    }

    // Assign sequential SS-N codes (sku == barcode) inside a transaction so the
    // counter bump and the product+variant inserts commit together.
    const product = await db.$transaction(async (tx) => {
      const codes = await allocateVariantCodes(tx, variants?.length ?? 0);
      const variantsWithCodes = variants?.map((v, i) => ({
        ...v,
        sku: codes[i]!,
        barcode: codes[i]!,
      }));

      return tx.product.create({
        data: {
          ...productData,
          slug,
          onlinePrice,
          taxSlabId: resolvedTaxSlabId,
          categoryId: primaryId,
          brandId,
          categories: { connect: connectIds.map((id) => ({ id })) },
          images: images ? { create: images } : undefined,
          variants: variantsWithCodes ? { create: variantsWithCodes } : undefined,
        },
        include: { images: true, variants: true, category: true },
      });
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, images, variants, categoryIds, ...productData } = body;

    if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    // Strip fields that aren't direct Product columns / are handled separately,
    // so a stray `category`/`taxSlab`/`sku` in the payload can't break the update.
    delete productData.id;
    delete productData.createdAt;
    delete productData.updatedAt;
    delete productData.category;
    delete productData.categories;
    delete productData.taxSlab;
    delete productData.brandRef;

    // Re-link the brand from the (possibly edited) free-text name. Only when the
    // form actually sent `brand`, so an unrelated PATCH-style payload can't clear it.
    if (productData.brand !== undefined) {
      productData.brandId = await resolveBrandId(productData.brand);
    }

    // Coerce an empty or unknown taxSlabId to null so it can't violate the FK
    // (the form sends "" for "No tax", and stale ids can survive in old payloads).
    if (productData.taxSlabId) {
      const ts = await db.taxSlab.findUnique({ where: { id: productData.taxSlabId }, select: { id: true } });
      if (!ts) productData.taxSlabId = null;
    } else {
      productData.taxSlabId = null;
    }

    // Multi-category: if categoryIds was sent, re-derive the primary + the full
    // m2m set. Falls back to whatever categoryId is in productData otherwise.
    let categoryUpdate: Record<string, unknown> = {};
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      const allIds = Array.from(
        new Set([...categoryIds, ...(productData.categoryId ? [productData.categoryId] : [])])
      );
      productData.categoryId = categoryIds[0];
      // Include ancestors so a subcategory tag also files the product under its
      // parent(s). `set` replaces the relation so de-selected categories are
      // removed (ancestors of what's still selected are re-added here).
      const setIds = await withAncestorCategoryIds(allIds);
      categoryUpdate = { categories: { set: setIds.map((cid: string) => ({ id: cid })) } };
    }

    type VariantInput = {
      id?: string;
      size?: string | null;
      color?: string | null;
      colorHex?: string | null;
      priceOverride?: number | null;
      mrp?: number | null;
      costPrice?: number | null;
      stock?: number;
      incentiveType?: "PERCENT" | "AMOUNT";
      incentiveValue?: number;
    };

    const product = await db.$transaction(async (tx) => {
      // Images: ADD / UPDATE only — a product Save must NEVER delete images.
      // The old "delete all + recreate from payload" wiped any image the form
      // didn't know about (e.g. an upload added in another tab/session, or one
      // that hadn't registered in form state yet), permanently orphaning the
      // S3 file. Deletions now happen ONLY through the explicit per-image
      // DELETE endpoint. Here we upsert by url (stable identity) and refresh
      // metadata; images absent from the payload are left untouched.
      if (images !== undefined) {
        const incoming = (images ?? []) as {
          url: string;
          alt?: string;
          color?: string;
          isPrimary?: boolean;
        }[];
        const existingImgs = await tx.productImage.findMany({
          where: { productId: id },
          select: { id: true, url: true },
        });
        const idByUrl = new Map(existingImgs.map((im) => [im.url, im.id]));
        for (let i = 0; i < incoming.length; i++) {
          const img = incoming[i]!;
          const existingId = idByUrl.get(img.url);
          const data = {
            alt: img.alt ?? null,
            color: img.color || null,
            sortOrder: i,
            isPrimary: !!img.isPrimary,
          };
          if (existingId) {
            await tx.productImage.update({ where: { id: existingId }, data });
          } else {
            await tx.productImage.create({ data: { productId: id, url: img.url, ...data } });
          }
        }
      }

      // Variants: NON-destructive diff so existing SS-N codes survive edits.
      //   • incoming with id  → update fields, keep its code
      //   • incoming w/o id   → allocate a fresh SS-N, create
      //   • existing missing  → delete (its code stays retired forever)
      if (variants !== undefined) {
        const incoming = (variants ?? []) as VariantInput[];
        const existing = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true },
        });
        const existingIds = new Set(existing.map((v) => v.id));
        const keptIds = new Set(
          incoming.map((v) => v.id).filter((vid): vid is string => !!vid && existingIds.has(vid))
        );

        // Remove variants the admin dropped.
        const toDelete = [...existingIds].filter((vid) => !keptIds.has(vid));
        if (toDelete.length) {
          await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
        }

        // Update kept variants (codes untouched).
        for (const v of incoming) {
          if (v.id && existingIds.has(v.id)) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                size: v.size ?? null,
                color: v.color ?? null,
                colorHex: v.colorHex ?? null,
                priceOverride: v.priceOverride ?? null,
                mrp: v.mrp ?? null,
                costPrice: v.costPrice ?? null,
                stock: v.stock ?? 0,
                ...(v.incentiveType ? { incentiveType: v.incentiveType } : {}),
                ...(v.incentiveValue != null ? { incentiveValue: v.incentiveValue } : {}),
              },
            });
          }
        }

        // Create brand-new variants with freshly allocated sequential codes.
        const newOnes = incoming.filter((v) => !v.id || !existingIds.has(v.id));
        const codes = await allocateVariantCodes(tx, newOnes.length);
        for (let i = 0; i < newOnes.length; i++) {
          const v = newOnes[i]!;
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: codes[i]!,
              barcode: codes[i]!,
              size: v.size ?? null,
              color: v.color ?? null,
              colorHex: v.colorHex ?? null,
              priceOverride: v.priceOverride ?? null,
              mrp: v.mrp ?? null,
              costPrice: v.costPrice ?? null,
              stock: v.stock ?? 0,
              ...(v.incentiveType ? { incentiveType: v.incentiveType } : {}),
              ...(v.incentiveValue != null ? { incentiveValue: v.incentiveValue } : {}),
            },
          });
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          ...productData,
          ...categoryUpdate,
          // images handled above (non-destructive upsert), not here.
        },
        include: { images: true, variants: true, category: true },
      });

      // Reconcile last-piece special pricing against the just-saved stock. A stock
      // edit here can cross the single-piece boundary in either direction (e.g. a
      // manual restock from 1 → 5 must pull the product back OUT of Special
      // Prices). Runs last so it sees the final stock + category set.
      await syncLastPieceSpecial(tx, id);

      // Re-read so the response reflects any price/category change sync just made.
      return (
        (await tx.product.findUnique({
          where: { id },
          include: { images: true, variants: true, category: true },
        })) ?? updated
      );
    });

    return NextResponse.json(product);
  } catch (error: any) {
    // Friendly message when admin tries to rename a product to an
    // already-used slug (Prisma unique-violation code).
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Slug already exists — pick a different slug" },
        { status: 409 }
      );
    }
    console.error("PUT /api/admin/products error:", error);
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

    // Soft delete
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
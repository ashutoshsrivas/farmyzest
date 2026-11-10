import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXCLUDE_EXCLUSIVE, HAS_IMAGE, IN_STOCK } from "@/lib/collections";
import { z } from "zod";
import { rateLimit, callerIp } from "@/lib/rate-limit";
import { isReseller } from "@/lib/pricing";

const productQuerySchema = z.object({
  category: z.string().optional(),
  collection: z.string().optional(),
  season: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
});

export async function GET(req: NextRequest) {
  // Public-facing listing. 60 hits / minute / IP — enough for legit shoppers
  // navigating filters but cuts off scraping bots.
  const ip = callerIp(req);
  const rl = rateLimit({ key: `products:${ip}`, max: 60, windowMs: 60_000 });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const params = Object.fromEntries(searchParams);
    const parsed = productQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const { category, collection, season, search, sort, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {
      status: "ACTIVE",
      // Public storefront API — never surface products hidden from the website
      // (they remain available in POS via /api/pos/* which don't filter this).
      showOnWebsite: true,
      // No image ⇒ not live on the website (still sellable in POS).
      ...HAS_IMAGE,
      // Out of stock ⇒ hidden from the website (search overlay queries this too)
      // until restocked. POS still sells it via /api/pos/*.
      ...IN_STOCK,
      // Hide products in collection-exclusive categories from public listing
      // and search (search overlay queries this endpoint). They appear only on
      // their collection page.
      ...EXCLUDE_EXCLUSIVE,
    };

    if (category) {
      where.category = { slug: category };
    }

    if (season) {
      where.season = season.toUpperCase();
    }

    if (search) {
      // Brand is intentionally a searchable field even though we don't
      // surface it in the storefront UI — typing "Nike" in the search bar
      // should still find Nike-branded products.
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search.toLowerCase()] } },
      ];
    }

    if (collection) {
      where.collections = {
        some: {
          collection: { slug: collection },
        },
      };
    }

    const orderBy: any = {};
    switch (sort) {
      case "newest":
        orderBy.createdAt = "desc";
        break;
      case "price_asc":
        orderBy.onlinePrice = "asc";
        break;
      case "price_desc":
        orderBy.onlinePrice = "desc";
        break;
      case "popular":
        orderBy.reviews = { _count: "desc" };
        break;
      default:
        orderBy.createdAt = "desc";
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          variants: { where: { stock: { gt: 0 } }, take: 1 },
          category: true,
        },
      }),
      db.product.count({ where }),
    ]);

    // Resellers see the wholesale price in place of the retail online price.
    const session = await auth();
    if (isReseller(session?.user?.role)) {
      for (const p of products) {
        if (p.resellerPrice != null) p.onlinePrice = p.resellerPrice;
      }
    }

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Admin: create product
const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string(),
  mrp: z.number().positive(),
  salePrice: z.number().optional(),
  sellingPrice: z.number().optional(),
  onlinePrice: z.number().positive(),
  taxSlabId: z.string().optional(),
  brand: z.string().optional(),
  tags: z.array(z.string()).optional(),
  season: z.enum(["SUMMER", "WINTER", "ALL"]).default("ALL"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  variants: z.array(z.object({
    sku: z.string(),
    barcode: z.string(),
    size: z.string().optional(),
    color: z.string().optional(),
    colorHex: z.string().optional(),
    priceOverride: z.number().optional(),
    stock: z.number().int().min(0).default(0),
  })).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { images, variants, ...productData } = parsed.data;

    const product = await db.product.create({
      data: {
        ...productData,
        images: images ? { create: images } : undefined,
        variants: variants ? { create: variants } : undefined,
      },
      include: {
        images: true,
        variants: true,
        category: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Product slug already exists" }, { status: 409 });
    }
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
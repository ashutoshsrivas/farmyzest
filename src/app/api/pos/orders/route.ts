import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { PaymentMethod, OrderSource } from "@prisma/client";
import { getOrCreateWallet, debitWallet, normalizePhone } from "@/lib/wallet";
import { ensureLoyaltyConfig, pointsForAmount } from "@/lib/loyalty";
import { syncLastPieceForVariants } from "@/lib/last-piece";
import { notifyPosOrderPlaced } from "@/lib/whatsapp";
import { sendOrderBill } from "@/lib/bill-delivery";
import { bestAutoTier, computeDiscount, mergeBestPerLine, type DiscountLine } from "@/lib/discount";
import { minCapPct } from "@/lib/pricing";

// Roles allowed to create / inspect POS orders. ADMIN can manage, POS_STAFF
// can ring up sales. Customers must never reach these endpoints.
const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

const createPosOrderSchema = z.object({
  salesmanId: z.string().min(1, "Salesman is required"),
  // "Attended by" — optional second salesman who served the customer.
  attendedById: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
        name: z.string().optional(),
        // Per-line discount (uncapped; the line floors at ₹0).
        discountType: z.enum(["PERCENT", "FIXED"]).optional(),
        discountValue: z.number().nonnegative().optional(),
        // Optional per-line (article-wise) salesman. Commission for this line
        // goes to this salesman, not the bill salesman.
        salesmanId: z.string().optional().nullable(),
      })
    )
    .min(1, "At least one item is required"),
  // Legacy single method (still accepted). Prefer `payments` for split tender.
  paymentMethod: z.enum(["CASH", "UPI", "GATEWAY"]).optional(),
  // Split-tender breakdown — how much of the (post-wallet) amount due is paid
  // by each method. Sum should equal the amount due; the server reconciles any
  // small rounding/wallet difference onto cash. `credit` = left owed.
  payments: z
    .object({
      cash: z.number().nonnegative().optional(),
      upi: z.number().nonnegative().optional(),
      card: z.number().nonnegative().optional(),
      credit: z.number().nonnegative().optional(),
    })
    .optional(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  // Email is OPTIONAL at POS (used for customer identification + loyalty when
  // present). Empty string is coerced to undefined; a non-empty value must be
  // a valid email.
  customerEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.string().email("Enter a valid customer email").max(160).optional()
  ),
  billDiscountType: z.enum(["PERCENT", "FIXED"]).optional(),
  billDiscountValue: z.number().nonnegative().optional(),
  // Optional manual coupon code entered at the counter. Validated + applied
  // (best-per-line) the same way the online store does; takes the better of it
  // and any automatic spend-tier offer.
  couponCode: z.string().trim().max(40).optional().nullable(),
  // Ad-hoc bill adjustment (delivery/packaging when +, or a manual reduction —
  // e.g. rounding a ₹10,105 bill down to ₹10,000 — when negative).
  additionalCharges: z.number().optional(),
  // When true, the server rounds the payable total to the nearest rupee and
  // records the adjustment in Order.roundOff.
  roundOff: z.boolean().optional(),
  // Fulfilment type for a POS sale.
  orderType: z.enum(["WALK_IN", "DELIVERY"]).optional(),
  // Store credit to deduct from this bill. Keyed by customerPhone; capped at
  // both the bill total and the available wallet balance server-side.
  walletRedeem: z.number().nonnegative().optional(),
  // Internal counter remark stored on the bill. NEVER printed on the customer
  // receipt — staff-only context (e.g. "alteration pending", "VIP", "paid via
  // friend's UPI").
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** ₹ off `base` for a discount; never exceeds base, so nets stay ≥ 0. */
function discountAmount(
  type: "PERCENT" | "FIXED" | undefined,
  value: number | undefined,
  base: number
): number {
  if (!value || value <= 0) return 0;
  const raw = type === "FIXED" ? value : (base * value) / 100;
  return Math.min(base, Math.max(0, raw));
}

/**
 * Most-restrictive discount cap (%) for a line — the tighter of the product's
 * and its category's maxDiscountPct. null = uncapped; 0 = no discount allowed.
 */
function effectiveCapPct(
  productCap: number | null | undefined,
  categoryCap: number | null | undefined
): number | null {
  const caps = [productCap, categoryCap].filter((c): c is number => c != null);
  return caps.length ? Math.min(...caps) : null;
}

/** Clamp a requested ₹ line discount to capPct% of the line's gross. */
function capLineDiscount(requested: number, gross: number, capPct: number | null): number {
  if (capPct == null) return requested;
  return Math.min(requested, Math.max(0, gross * (capPct / 100)));
}

/**
 * GET /api/pos/orders — list POS orders with optional filters
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const salesmanId = searchParams.get("salesmanId") ?? undefined;
  const take = parseInt(searchParams.get("take") ?? "50");
  const skip = parseInt(searchParams.get("skip") ?? "0");

  const where: Record<string, unknown> = { source: "POS" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo)
      (where.createdAt as Record<string, Date>).lte = new Date(dateTo + "T23:59:59.999Z");
  }
  if (salesmanId) where.salesmanId = salesmanId;

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        salesman: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, take, skip });
}

/**
 * POST /api/pos/orders
 * Full transactional POS order creation:
 *   1. Validate all items exist and have sufficient stock
 *   2. Calculate subtotal + per-item tax (lookup taxSlab)
 *   3. Create Order + OrderItems
 *   4. Deduct variant stock
 *   5. Create / update PosSession for the salesman today
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createPosOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const {
      salesmanId,
      attendedById,
      items,
      paymentMethod,
      payments,
      customerName,
      customerPhone,
      customerEmail,
      billDiscountType,
      billDiscountValue,
      couponCode,
      additionalCharges = 0,
      roundOff: wantRoundOff = false,
      orderType,
      walletRedeem = 0,
      notes,
    } = parsed.data;

    // Requested split breakdown (null = legacy single-method payment).
    const reqPaid = payments
      ? {
          cash: payments.cash || 0,
          upi: payments.upi || 0,
          card: payments.card || 0,
          credit: payments.credit || 0,
        }
      : null;

    // Canonicalise the phone to its last-10-digits so the SAME customer billed
    // twice — once as "9897282141", once as "+91 98972 82141" — collapses into
    // one record on the Customers page and is found by the exchange/wallet
    // lookup. Without this, a repeat bill on the same person showed up as a
    // brand-new (or invisible) contact. Falls back to the trimmed raw input for
    // anything that isn't a 10-digit mobile (e.g. a landline).
    const normalizedPhone = normalizePhone(customerPhone);
    const billingPhone =
      normalizedPhone.length === 10 ? normalizedPhone : customerPhone?.trim() || null;

    // Validate salesman is active
    const salesman = await db.salesman.findUnique({ where: { id: salesmanId } });
    if (!salesman || !salesman.isActive) {
      return NextResponse.json({ error: "Invalid or inactive salesman" }, { status: 400 });
    }

    // Catalog vs cash lines. Cash items (productId === "cash") have no variant —
    // they carry no stock and price comes from the client's unitPrice.
    const catalogItems = items.filter((i) => i.productId !== "cash");
    const variantIds = catalogItems.map((i) => i.variantId);
    const variants = variantIds.length
      ? await db.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { include: { taxSlab: true, category: true, brandRef: true } } },
        })
      : [];

    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: "One or more variants not found" }, { status: 400 });
    }

    // Check stock availability (catalog only)
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const insufficient: { variantId: string; name: string; available: number; requested: number }[] = [];
    for (const item of catalogItems) {
      const variant = variantMap.get(item.variantId)!;
      if (variant.stock < item.quantity) {
        insufficient.push({
          variantId: item.variantId,
          name: `${variant.product.name}${variant.size ? ` (${variant.size})` : ""}`,
          available: variant.stock,
          requested: item.quantity,
        });
      }
    }
    if (insufficient.length > 0) {
      return NextResponse.json({ error: "Insufficient stock", insufficient }, { status: 409 });
    }

    // Automatic spend-tier discount — applied by cart value with no code, the
    // same engine the online store uses. Qualify on the NET (post line-discount)
    // value of each line so the tier composes cleanly with per-item discounts.
    const discountLines: DiscountLine[] = items.map((item) => {
      const variant = variantMap.get(item.variantId);
      const listUnit =
        item.unitPrice ??
        (variant
          ? variant.priceOverride ?? variant.product.onlinePrice ?? variant.product.mrp
          : 0);
      const gross = listUnit * item.quantity;
      const dAmt = discountAmount(item.discountType, item.discountValue, gross);
      const netUnit = item.quantity > 0 ? (gross - dAmt) / item.quantity : 0;
      return {
        productId: variant ? variant.productId : "cash",
        categoryId: variant ? variant.product.categoryId : "",
        unitPrice: netUnit,
        quantity: item.quantity,
        productMaxDiscountPct: variant ? variant.product.maxDiscountPct ?? null : null,
        // POS-effective cap = general cap tightened by the POS cap, across both
        // the product's category AND its brand (most restrictive wins).
        categoryMaxDiscountPct: variant
          ? minCapPct(
              variant.product.category?.maxDiscountPct,
              variant.product.category?.maxPosDiscountPct,
              variant.product.brandRef?.maxDiscountPct,
              variant.product.brandRef?.maxPosDiscountPct
            )
          : null,
      };
    });
    const autoCoupons = await db.coupon.findMany({
      where: { autoApply: true, isActive: true },
    });
    // Manual discounting takes over: if any line or the bill carries a manual
    // discount, suppress promo offers (matches the POS UI).
    const hasManualDiscount =
      items.some((i) => (i.discountValue ?? 0) > 0) || (billDiscountValue ?? 0) > 0;

    // Promo = automatic spend tier + an optional entered coupon code, merged
    // BEST-PER-LINE (never additive) — identical to /api/coupons/validate so the
    // on-screen total never diverges from what's charged.
    let promoDiscount = 0;
    let promoCouponId: string | null = null;
    let promoLabel: string | null = null;
    if (!hasManualDiscount) {
      const autoTier = bestAutoTier(autoCoupons, discountLines);
      let codeResult = null as ReturnType<typeof computeDiscount> | null;
      let enteredId: string | null = null;
      let enteredCode: string | null = null;
      const code = couponCode?.trim().toUpperCase();
      if (code) {
        const coupon = await db.coupon.findUnique({ where: { code } });
        if (coupon) {
          const r = computeDiscount(coupon, discountLines);
          if (r.valid) { codeResult = r; enteredId = coupon.id; enteredCode = coupon.code; }
        }
      }
      const merged = mergeBestPerLine(discountLines, [autoTier?.result, codeResult]);
      promoDiscount = merged.discountTotal;
      const autoTotal = autoTier?.result.discountTotal ?? 0;
      if (enteredId && merged.discountTotal > autoTotal) {
        promoCouponId = enteredId;
        promoLabel = enteredCode;
      } else if (autoTier) {
        promoCouponId = autoTier.coupon.id;
        promoLabel = autoTier.coupon.code;
      }
    }
    const autoTierDiscount = promoDiscount;
    const autoCouponId = promoCouponId;

    // ── Transaction ──────────────────────────────────────────────────────────
    const order = await db.$transaction(async (tx) => {
      const orderItemsData: {
        productId: string;
        variantId: string | null;
        productName: string;
        variantLabel: string | null;
        sku: string | null;
        barcode: string | null;
        imageUrl: string | null;
        quantity: number;
        unitPrice: number;
        taxPercent: number | null;
        totalPrice: number;
        listPrice: number | null;
        discount: number;
        discountType: string | null;
        discountValue: number | null;
        costPriceSnapshot: number | null;
        salesmanId: string | null;
      }[] = [];

      // Valid salesman ids, so a stray per-line salesmanId can't break the FK —
      // an unknown id is simply ignored (line falls back to the bill salesman).
      const validSalesmanIds = new Set(
        (await tx.salesman.findMany({ select: { id: true } })).map((s) => s.id)
      );

      let subtotal = 0; // gross (pre-discount list value)
      let lineDiscountTotal = 0;
      // Per-line gross / line-discount / cap, used to distribute the bill-level
      // discount per line and cap each at its own max-discount.
      const lineCapInfo: { gross: number; lineDisc: number; capPct: number | null }[] = [];
      // GST-inclusive selling: no tax is added at POS (only supplier bills carry
      // GST). We still record each item's embedded slab in taxPercent for
      // reference, but Order.taxAmount stays 0 and isn't added to the total.

      for (const item of items) {
        const variant = variantMap.get(item.variantId); // undefined for cash
        // List unit price: explicit override > variant override > online > mrp.
        const listUnit =
          item.unitPrice ??
          (variant
            ? variant.priceOverride ?? variant.product.onlinePrice ?? variant.product.mrp
            : 0);
        const taxPercent = variant?.product.taxSlab?.percentage ?? 0;

        const gross = listUnit * item.quantity;
        // Enforce the product/category max-discount cap on the manual line
        // discount — a cashier can't exceed it, the order silently records the
        // capped value. Cash items (no variant) are uncapped.
        const capPct = variant
          ? effectiveCapPct(
              variant.product.maxDiscountPct,
              minCapPct(
                variant.product.category?.maxDiscountPct,
                variant.product.category?.maxPosDiscountPct,
                variant.product.brandRef?.maxDiscountPct,
                variant.product.brandRef?.maxPosDiscountPct
              )
            )
          : null;
        const dAmt = capLineDiscount(
          discountAmount(item.discountType, item.discountValue, gross),
          gross,
          capPct
        );
        const net = gross - dAmt;
        const netUnit = item.quantity > 0 ? net / item.quantity : 0;

        subtotal += gross;
        lineDiscountTotal += dAmt;
        lineCapInfo.push({ gross, lineDisc: dAmt, capPct });

        let imageUrl: string | null = null;
        if (variant) {
          const primaryImage = await tx.productImage.findFirst({
            where: { productId: variant.productId, isPrimary: true },
            select: { url: true },
          });
          imageUrl = primaryImage?.url ?? null;
        }

        const variantLabel = variant
          ? [variant.color, variant.size].filter(Boolean).join(" / ") || null
          : null;

        orderItemsData.push({
          productId: variant ? variant.productId : "cash",
          variantId: variant ? variant.id : null,
          productName: variant ? variant.product.name : item.name?.trim() || "Custom item",
          variantLabel,
          sku: variant?.sku ?? null,
          barcode: variant?.barcode ?? null,
          imageUrl,
          quantity: item.quantity,
          // unitPrice = NET per-unit paid (so exchange history shows the
          // discounted price the customer actually paid).
          unitPrice: netUnit,
          taxPercent: taxPercent > 0 ? taxPercent : null,
          totalPrice: net,
          listPrice: listUnit,
          discount: dAmt,
          // Preserve the ORIGINAL discount type + its effective value (after any
          // max-discount cap) so an edited bill restores %-as-% and ₹-as-₹.
          discountType: dAmt > 0 ? (item.discountType ?? "FIXED") : null,
          discountValue:
            dAmt > 0
              ? item.discountType === "PERCENT"
                ? gross > 0
                  ? (dAmt / gross) * 100
                  : 0
                : dAmt
              : null,
          costPriceSnapshot: variant?.product.costPrice ?? null,
          // Per-line salesman only when it's a real, different salesman.
          salesmanId:
            item.salesmanId && item.salesmanId !== salesmanId && validSalesmanIds.has(item.salesmanId)
              ? item.salesmanId
              : null,
        });
      }

      // Bill-level discount applies to the net (post-line-discount) subtotal,
      // distributed PER LINE and capped at each line's own max-discount. So a
      // 20% bill discount gives 20% on an uncapped item but only 15% on one
      // capped at 15% — the per-line shares are summed (never clamped to the
      // strictest item).
      const netSubtotal = subtotal - lineDiscountTotal;
      const billVal = billDiscountValue ?? 0;
      let billDisc = 0;
      if (billVal > 0 && netSubtotal > 0) {
        const reqTotal = discountAmount(billDiscountType, billVal, netSubtotal);
        for (const li of lineCapInfo) {
          const lineNet = li.gross - li.lineDisc;
          if (lineNet <= 0) continue;
          const reqLine =
            billDiscountType === "FIXED"
              ? reqTotal * (lineNet / netSubtotal)
              : discountAmount("PERCENT", billVal, lineNet);
          const room = li.capPct == null ? Infinity : Math.max(0, li.gross * (li.capPct / 100) - li.lineDisc);
          billDisc += Math.min(reqLine, room);
        }
        billDisc = Math.round(billDisc * 100) / 100;
      }
      // Auto spend-tier discount stacks on top of any line / manual bill discount.
      const totalDiscount = lineDiscountTotal + billDisc + autoTierDiscount;
      // GST-inclusive: goods value minus discounts, plus any ad-hoc charges
      // (which may be negative for a manual downward adjustment). The bill can
      // never go below zero.
      const charges = additionalCharges;
      const preRound = Math.max(0, Math.max(0, subtotal - totalDiscount) + charges);
      // Round-off: snap to the nearest rupee; store the signed adjustment.
      const roundOffAmt = wantRoundOff ? Math.round(preRound) - preRound : 0;
      const total = Math.round((preRound + roundOffAmt) * 100) / 100;

      // Generate POS order number: POS-YYYYMMDD-NNNN
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const sessionDayStart = new Date(today.toISOString().slice(0, 10) + "T00:00:00.000Z");
      const sessionDayEnd = new Date(sessionDayStart.getTime() + 86400000);
      const countToday = await tx.order.count({
        where: {
          source: "POS",
          createdAt: { gte: sessionDayStart, lt: sessionDayEnd },
        },
      });
      const posOrderNum = `POS-${dateStr}-${String(countToday + 1).padStart(4, "0")}`;

      // Link a customer profile by email (when one was entered) so POS sales
      // earn loyalty and show in the customer's order history. Email is optional
      // at POS — without it there's no profile to credit, so no loyalty.
      const posEmail = customerEmail ?? null; // already trimmed + lowercased by zod
      let posUserId: string | null = null;
      if (posEmail) {
        const existingUser = await tx.user.findUnique({ where: { email: posEmail }, select: { id: true } });
        posUserId = existingUser
          ? existingUser.id
          : (await tx.user.create({
              data: { email: posEmail, name: customerName?.trim() || "Customer", phone: billingPhone || undefined, role: "CUSTOMER" },
              select: { id: true },
            })).id;
      }

      // Loyalty earned at sale (only when we have a customer profile to credit).
      // Shared config helper → 0 points when the program is disabled, and a real
      // config row always exists so earning is consistent with redemption.
      const loyaltyCfg = await ensureLoyaltyConfig(tx);
      const posEarned = posUserId ? pointsForAmount(subtotal, loyaltyCfg) : 0;

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          source: "POS" as OrderSource,
          userId: posUserId,
          loyaltyAwarded: posEarned > 0,
          salesmanId,
          attendedById: attendedById || null,
          posOrderNum,
          // An in-store POS sale is complete the moment it's billed — goods are
          // handed over at the counter. Mark it DELIVERED (the terminal "done"
          // status) rather than PENDING, which is for online orders awaiting
          // fulfilment.
          status: "DELIVERED",
          // Goods leave the shelf immediately at the counter → stock deducted.
          stockDeducted: true,
          paymentMethod: (reqPaid
            ? ([reqPaid.cash, reqPaid.upi, reqPaid.card, reqPaid.credit].filter((v) => v > 0).length > 1
                ? "SPLIT"
                : reqPaid.cash > 0 ? "CASH" : reqPaid.upi > 0 ? "UPI" : reqPaid.card > 0 ? "GATEWAY" : "CREDIT")
            : (paymentMethod ?? "CASH")) as PaymentMethod,
          paymentStatus: "PAID",
          subtotal,
          taxAmount: 0,
          discount: totalDiscount,
          additionalCharges: charges,
          roundOff: roundOffAmt,
          orderType: orderType ?? "WALK_IN",
          total,
          walletApplied: 0, // set below once the wallet debit is confirmed
          couponId: autoCouponId, // promo (auto tier or entered code) for reporting
          billingName: customerName?.trim() || null,
          billingEmail: posEmail,
          billingPhone,
          notes: notes?.trim() || null, // internal — not on the printed receipt
          items: { create: orderItemsData },
        },
        include: { items: true },
      });

      // Credit the loyalty points earned on this sale.
      if (posEarned > 0 && posUserId) {
        await tx.user.update({
          where: { id: posUserId },
          data: { loyaltyPoints: { increment: posEarned } },
        });
        await tx.loyaltyTransaction.create({
          data: { userId: posUserId, orderId: newOrder.id, type: "EARN", points: posEarned, description: `POS sale ${posOrderNum}` },
        });
      }

      // Deduct stock (catalog items only)
      for (const item of catalogItems) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      // A sale may have taken a product to its last piece.
      await syncLastPieceForVariants(tx, catalogItems.map((i) => i.variantId));

      // Apply store credit (capped at the bill total and the live balance).
      let walletApplied = 0;
      if (walletRedeem > 0 && customerPhone?.trim()) {
        const wallet = await getOrCreateWallet(tx, customerPhone);
        if (wallet) {
          walletApplied = await debitWallet(
            tx,
            wallet.id,
            Math.min(walletRedeem, total),
            "POS_REDEEM",
            `POS sale · ${posOrderNum}`,
            { orderId: newOrder.id }
          );
          if (walletApplied > 0) {
            await tx.order.update({
              where: { id: newOrder.id },
              data: { walletApplied },
            });
            newOrder.walletApplied = walletApplied;
          }
        }
      }

      // Create or update today's POS session
      const existingSession = await tx.posSession.findFirst({
        where: {
          salesmanId,
          date: { gte: sessionDayStart, lt: sessionDayEnd },
        },
      });

      // Amount actually collected (across methods) excludes the wallet-paid
      // portion; totalSales still reflects full goods value.
      const tendered = Math.max(0, total - walletApplied);

      // Resolve the final per-method split. For a legacy single method the
      // whole tendered goes to it; for a split we take the requested amounts
      // and reconcile any small rounding / wallet-cap difference onto cash.
      const paid = { cash: 0, upi: 0, card: 0, credit: 0 };
      if (reqPaid) {
        paid.cash = reqPaid.cash; paid.upi = reqPaid.upi; paid.card = reqPaid.card; paid.credit = reqPaid.credit;
        const sum = paid.cash + paid.upi + paid.card + paid.credit;
        const diff = tendered - sum;
        if (Math.abs(diff) > 0.01) paid.cash = Math.max(0, paid.cash + diff);
      } else if (paymentMethod === "CASH") paid.cash = tendered;
      else if (paymentMethod === "UPI") paid.upi = tendered;
      else paid.card = tendered; // GATEWAY / default

      const nonZero = [paid.cash, paid.upi, paid.card, paid.credit].filter((v) => v > 0.01).length;
      const finalMethod: PaymentMethod =
        nonZero > 1 ? "SPLIT" : paid.cash > 0 ? "CASH" : paid.upi > 0 ? "UPI" : paid.card > 0 ? "GATEWAY" : paid.credit > 0 ? "CREDIT" : "CASH";

      await tx.order.update({
        where: { id: newOrder.id },
        data: {
          paymentMethod: finalMethod,
          paidCash: paid.cash,
          paidUpi: paid.upi,
          paidCard: paid.card,
          paidCredit: paid.credit,
        },
      });
      newOrder.paymentMethod = finalMethod;
      newOrder.paidCash = paid.cash;
      newOrder.paidUpi = paid.upi;
      newOrder.paidCard = paid.card;
      newOrder.paidCredit = paid.credit;

      if (existingSession) {
        await tx.posSession.update({
          where: { id: existingSession.id },
          data: {
            totalSales: { increment: total },
            totalCash: { increment: paid.cash },
            totalGateway: { increment: paid.card },
            totalUpi: { increment: paid.upi },
            totalCredit: { increment: paid.credit },
            orderCount: { increment: 1 },
          },
        });
      } else {
        await tx.posSession.create({
          data: {
            salesmanId,
            date: sessionDayStart,
            startTime: today,
            totalSales: total,
            totalCash: paid.cash,
            totalGateway: paid.card,
            totalUpi: paid.upi,
            totalCredit: paid.credit,
            orderCount: 1,
          },
        });
      }

      return newOrder;
    });

    // Email the receipt to the customer when an email was captured (optional).
    if (order.billingEmail) {
      notifyPosOrderPlaced(order.billingEmail, {
        orderId: order.id,
        orderNumber: order.posOrderNum!,
        customerName: order.billingName ?? "there",
        customerEmail: order.billingEmail,
        customerPhone: order.billingPhone ?? undefined,
        total: order.total,
        itemCount: order.items.length,
      }).catch(() => {});
    }

    // Deliver the tax-invoice PDF (email attachment + WhatsApp document). Fully
    // fire-and-forget — bill delivery must never affect the POS response.
    void sendOrderBill(order.id).catch((err) => console.error("[Bill] POS delivery failed:", err));

    const receiptData = {
      orderId: order.id,
      orderNumber: order.posOrderNum!,
      date: order.createdAt.toISOString(),
      salesman: salesman.name,
      customerName: order.billingName,
      customerPhone: order.billingPhone,
      items: order.items.map((item) => ({
        name: item.productName,
        variant: item.variantLabel ?? "—",
        sku: item.sku,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        taxPercent: item.taxPercent,
        total: item.totalPrice,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      taxAmount: order.taxAmount,
      total: order.total,
      walletApplied: order.walletApplied,
      amountDue: Math.max(0, order.total - order.walletApplied),
      autoDiscount: autoTierDiscount,
      autoLabel: promoLabel,
      additionalCharges: order.additionalCharges,
      roundOff: order.roundOff,
      paymentMethod: order.paymentMethod,
      paidCash: order.paidCash,
      paidUpi: order.paidUpi,
      paidCard: order.paidCard,
      paidCredit: order.paidCredit,
    };

    return NextResponse.json({ success: true, ...receiptData }, { status: 201 });
  } catch (err) {
    console.error("[POS Orders] Error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
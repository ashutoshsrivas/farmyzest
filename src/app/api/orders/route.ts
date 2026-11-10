import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, callerIp } from "@/lib/rate-limit";
import { getWalletForUser, debitWallet } from "@/lib/wallet";
import { ensureLoyaltyConfig } from "@/lib/loyalty";
import { notifyOnlineOrderPlaced } from "@/lib/whatsapp";
import { sendOrderBill } from "@/lib/bill-delivery";
import {
  computeDiscount,
  bestAutoTier,
  mergeBestPerLine,
  type DiscountLine,
} from "@/lib/discount";
import { isReseller, applyDiscount, categoryDiscountPct, minCapPct } from "@/lib/pricing";
import { isCodEnabled, getPartialPaymentConfig } from "@/lib/store-settings";

// GET = admin-only. Previously open; was returning every order in the
// system to anyone who hit /api/orders. Customers list their own orders
// from /account/orders which queries by userId server-side.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST = create an online order from the cart.
// Logged-in customers are tied to the row via userId so they can see it on
// /account/orders. Anonymous checkout is still allowed (guest order) but
// won't appear in the account view.
const orderItemSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100),
  // NOTE: price is never taken from the client. It's always derived server-side
  // from the variant/product in the DB. A `unitPrice` in the body is ignored —
  // trusting it let a buyer set any price (e.g. order a ₹50k item for ₹1) and,
  // because PayU's callback only checks the paid amount against the stored
  // order total, the fraudulent ₹1 payment would verify cleanly.
});

const orderBodySchema = z.object({
  email: z.string().email("A valid email is required"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(40)
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid 10-digit phone"),
  name: z.string().trim().min(1, "Name is required").max(200),
  address: z.string().trim().max(500),
  city: z.string().trim().max(120),
  state: z.string().trim().max(120),
  pincode: z.string().trim().max(20),
  paymentMethod: z.enum(["COD", "RAZORPAY", "ONLINE", "PARTIAL"]).default("ONLINE"),
  items: z.array(orderItemSchema).min(1),
  /** Loyalty points to redeem against this order (0 to skip). */
  redeemPoints: z.number().int().min(0).optional(),
  /** Store-credit (wallet) ₹ to apply (0 to skip). Logged-in shoppers only. */
  redeemWallet: z.number().min(0).optional(),
  /** Optional discount coupon code (re-validated server-side here). */
  couponCode: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest) {
  // Rate limit before doing any DB work. 10 orders / minute / IP is generous
  // for real shoppers but cuts off scripted abuse.
  const ip = callerIp(req);
  const rl = rateLimit({ key: `orders:${ip}`, max: 10, windowMs: 60_000 });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = orderBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Enforce the COD toggle server-side — a hidden option can't be slipped in via
  // the API. Only "COD" is gated; online payment is always available.
  if (parsed.data.paymentMethod === "COD" && !(await isCodEnabled())) {
    return NextResponse.json(
      { error: "Cash on Delivery is currently unavailable. Please pay online." },
      { status: 400 }
    );
  }

  // Partial-payment (advance now, balance on delivery) — only when the admin
  // enabled it with a valid percent. The percent is read server-side; the
  // client value is never trusted.
  const partialConfig = await getPartialPaymentConfig();
  if (parsed.data.paymentMethod === "PARTIAL" && !partialConfig.enabled) {
    return NextResponse.json(
      { error: "Partial payment is currently unavailable." },
      { status: 400 }
    );
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const resellerOrder = isReseller(session?.user?.role);
  const {
    email,
    phone,
    name,
    address,
    city,
    state,
    pincode,
    paymentMethod,
    items,
    redeemPoints = 0,
    redeemWallet = 0,
    couponCode,
  } = parsed.data;

  try {
    // Pre-fetch the variants we need so the transaction can be tight.
    const variantIds = items.map((i) => i.variantId);
    const variants = await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      // We pull `product.costPrice` here so each OrderItem can snapshot it
      // — keeps historical profit reports accurate after admin edits costs.
      // `category` is needed for the coupon engine's per-category discount caps.
      include: { product: { include: { taxSlab: true, category: true, brandRef: true } } },
    });
    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: "One or more variants not found" }, { status: 400 });
    }
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Stock check up front so we fail fast.
    const insufficient: { variantId: string; available: number; requested: number }[] = [];
    for (const item of items) {
      const v = variantMap.get(item.variantId)!;
      if (v.stock < item.quantity) {
        insufficient.push({
          variantId: item.variantId,
          available: v.stock,
          requested: item.quantity,
        });
      }
    }
    if (insufficient.length) {
      return NextResponse.json({ error: "Insufficient stock", insufficient }, { status: 409 });
    }

    // Compute subtotal & line items (no DB writes yet).
    let subtotal = 0;
    const orderItemsData: {
      productId: string;
      variantId: string;
      productName: string;
      variantLabel: string | null;
      sku: string;
      barcode: string | null;
      imageUrl: string | null;
      quantity: number;
      unitPrice: number;
      taxPercent: number | null;
      totalPrice: number;
      costPriceSnapshot: number | null;
    }[] = [];
    for (const item of items) {
      const v = variantMap.get(item.variantId)!;
      // Price is authoritative from the DB for everyone — never from the client.
      // Resellers get the wholesale price; everyone else: variant override →
      // online → mrp, then minus the category discount (retail only).
      const unitPrice =
        resellerOrder && v.product.resellerPrice != null
          ? v.product.resellerPrice
          : applyDiscount(
              v.priceOverride ?? v.product.onlinePrice ?? v.product.mrp,
              categoryDiscountPct(v.product)
            );
      const totalPrice = unitPrice * item.quantity;
      const taxPercent = v.product.taxSlab?.percentage ?? 0;
      subtotal += totalPrice;
      orderItemsData.push({
        productId: v.productId,
        variantId: v.id,
        productName: v.product.name,
        variantLabel: [v.color, v.size].filter(Boolean).join(" / ") || null,
        sku: v.sku,
        barcode: v.barcode,
        imageUrl: null, // filled inside the transaction
        quantity: item.quantity,
        unitPrice,
        taxPercent: taxPercent > 0 ? taxPercent : null,
        totalPrice,
        costPriceSnapshot: v.product.costPrice ?? null,
      });
    }
    // Online prices are TAX-INCLUSIVE (onlinePrice already contains GST). The
    // tax is shown only as a breakup EXTRACTED from the price — never added on
    // top, or the customer pays tax twice. Per line: inclusive × rate/(100+rate).
    const taxAmount = orderItemsData.reduce((sum, it) => {
      const r = it.taxPercent ?? 0;
      if (r <= 0) return sum;
      return sum + Math.round((it.unitPrice * it.quantity * r) / (100 + r));
    }, 0);
    // Free shipping site-wide — no delivery charge on the bill.
    let shipping = 0;

    // Discount = automatic spend tier (everyone) + optional entered code,
    // taking the best discount per line (never additive). Re-computed
    // server-side — the checkout preview is advisory.
    let couponDiscount = 0;
    let couponId: string | null = null; // recorded on the order (code or tier)
    let usedCodeId: string | null = null; // only an entered code that counted
    // Resellers pay wholesale as-is — no spend tiers or coupon codes apply.
    if (!resellerOrder) {
      const lines: DiscountLine[] = items.map((item) => {
        const v = variantMap.get(item.variantId)!;
        return {
          productId: v.productId,
          categoryId: v.product.categoryId,
          // Coupons compute off the already category-discounted price, matching
          // what the customer is charged.
          unitPrice: applyDiscount(
            v.priceOverride ?? v.product.onlinePrice ?? v.product.mrp,
            categoryDiscountPct(v.product)
          ),
          quantity: item.quantity,
          productMaxDiscountPct: v.product.maxDiscountPct ?? null,
          // Online-effective category cap = general cap tightened by the online cap.
          categoryMaxDiscountPct: minCapPct(v.product.category.maxDiscountPct, v.product.category.maxOnlineDiscountPct),
        };
      });

      const autoCoupons = await db.coupon.findMany({ where: { autoApply: true, isActive: true } });
      const autoTier = bestAutoTier(autoCoupons, lines);

      let codeResult = null as ReturnType<typeof computeDiscount> | null;
      let enteredCoupon: { id: string } | null = null;
      if (couponCode) {
        const coupon = await db.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
        if (coupon) {
          const r = computeDiscount(coupon, lines);
          // Silently ignore an invalid/non-beating code — the auto tier still applies.
          if (r.valid) {
            codeResult = r;
            enteredCoupon = coupon;
          }
        }
      }

      const merged = mergeBestPerLine(lines, [autoTier?.result, codeResult]);
      couponDiscount = merged.discountTotal;
      if (merged.freeShipping) shipping = 0;

      const autoDiscount = autoTier?.result.discountTotal ?? 0;
      if (enteredCoupon && couponDiscount > autoDiscount) {
        couponId = enteredCoupon.id;
        usedCodeId = enteredCoupon.id;
      } else if (autoTier) {
        couponId = autoTier.coupon.id;
      }
    }

    // Loyalty redemption (only for logged-in shoppers).
    let discountFromPoints = 0;
    let pointsToBurn = 0;
    if (redeemPoints > 0 && userId) {
      const [user, loyaltyConfig] = await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: { loyaltyPoints: true },
        }),
        ensureLoyaltyConfig(),
      ]);
      if (!user || !loyaltyConfig.isActive) {
        return NextResponse.json(
          { error: "Loyalty redemption unavailable right now." },
          { status: 400 }
        );
      }
      if (subtotal < loyaltyConfig.minRedeemAmount) {
        return NextResponse.json(
          {
            error: `Order subtotal must be at least ₹${loyaltyConfig.minRedeemAmount} to redeem points.`,
          },
          { status: 400 }
        );
      }
      pointsToBurn = Math.min(redeemPoints, Math.floor(user.loyaltyPoints));
      discountFromPoints = Math.min(
        pointsToBurn * loyaltyConfig.rupeeValuePerPoint,
        // Cap discount at subtotal (tax-inclusive) so the customer never gets
        // paid to shop. Tax is embedded in the price, not added on top.
        subtotal
      );
    }

    // Tax-inclusive: total is the price subtotal minus discounts. taxAmount is
    // the embedded GST shown as a breakup only — NOT added here.
    const totalBeforeWallet =
      subtotal + shipping - discountFromPoints - couponDiscount;
    if (totalBeforeWallet < 0) {
      return NextResponse.json(
        { error: "Computed total is negative — please reduce redeemed points." },
        { status: 400 }
      );
    }

    // Store-credit (wallet) redemption — logged-in shoppers only. Clamp the
    // requested amount to both the payable and the live balance. The actual
    // debit happens inside the transaction (and is re-capped there).
    let walletApplied = 0;
    let walletId: string | null = null;
    if (redeemWallet > 0 && userId) {
      const wallet = await getWalletForUser(userId);
      if (wallet && wallet.balance > 0) {
        walletId = wallet.id;
        walletApplied = Math.min(redeemWallet, totalBeforeWallet, wallet.balance);
      }
    }
    const total = Math.max(0, totalBeforeWallet - walletApplied);

    // Partial payment split: customer pays `advance` now via PayU, `balanceDue`
    // on delivery. Stored as a SPLIT order (paidCredit = balance) so revenue
    // reports don't count the unpaid balance as collected. The advance itself is
    // recorded (paidUpi) only once PayU confirms it in the callback.
    const isPartial = paymentMethod === "PARTIAL";
    const balanceDue = isPartial
      ? Math.max(0, total - Math.round(total * (partialConfig.percent / 100)))
      : 0;
    const storedMethod: "COD" | "ONLINE" | "SPLIT" =
      paymentMethod === "COD" ? "COD" : isPartial ? "SPLIT" : "ONLINE";

    // ── Atomic write: order + line items + stock decrement + loyalty burn ──
    const order = await db.$transaction(async (tx) => {
      // Re-resolve primary images inside the tx so the row is consistent.
      for (const it of orderItemsData) {
        const img = await tx.productImage.findFirst({
          where: { productId: it.productId, isPrimary: true },
          select: { url: true },
        });
        it.imageUrl = img?.url ?? null;
      }

      // Auto-create (or link) a customer profile from the checkout email so the
      // shopper gets an account + order history they can later access via email
      // OTP login. Logged-in shoppers keep their existing id.
      let orderUserId = userId;
      if (!orderUserId) {
        const lcEmail = email.trim().toLowerCase();
        const existing = await tx.user.findUnique({ where: { email: lcEmail }, select: { id: true } });
        orderUserId = existing
          ? existing.id
          : (await tx.user.create({
              data: { email: lcEmail, name, phone, role: "CUSTOMER" },
              select: { id: true },
            })).id;
      }

      const created = await tx.order.create({
        data: {
          source: "ONLINE",
          userId: orderUserId ?? undefined,
          paymentMethod: storedMethod,
          paymentStatus: "PENDING",
          status: "PENDING",
          subtotal,
          taxAmount,
          discount: discountFromPoints + couponDiscount,
          loyaltyDiscount: discountFromPoints,
          pointsRedeemed: pointsToBurn,
          total,
          walletApplied,
          // Partial orders: the rest, collected on delivery. 0 otherwise.
          paidCredit: balanceDue,
          couponId: couponId ?? undefined,
          billingName: name,
          billingEmail: email.trim().toLowerCase(),
          billingPhone: phone,
          billingAddress: address,
          billingCity: city,
          billingState: state,
          billingPincode: pincode,
          shippingName: name,
          shippingPhone: phone,
          shippingAddress: address,
          shippingCity: city,
          shippingState: state,
          shippingPincode: pincode,
          items: { create: orderItemsData },
        },
      });

      // NOTE: stock is NOT decremented here. A freshly placed order sits in
      // PENDING and does not hold inventory — the deduction happens later, when
      // the order is moved to a fulfilment status (Shipped/Out-for-delivery/
      // Delivered) in the admin. See src/lib/order-status.ts + the PATCH route.
      // The up-front availability check above still prevents ordering items
      // that are already out of stock.

      // Burn loyalty points only after the order is committed. Record the
      // redemption in the ledger (REDEEM = negative points, mirroring the EARN
      // convention) so the customer's points history stays reconciled with their
      // balance and the redemption is auditable per order.
      if (pointsToBurn > 0 && userId) {
        await tx.user.update({
          where: { id: userId },
          data: { loyaltyPoints: { decrement: pointsToBurn } },
        });
        await tx.loyaltyTransaction.create({
          data: {
            userId,
            orderId: created.id,
            type: "REDEEM",
            points: -pointsToBurn,
            description: `Redeemed on order ${created.id.slice(-8).toUpperCase()}`,
          },
        });
      }

      // Spend store credit (re-capped at the live balance inside the tx). If
      // the balance dropped between the pre-read and here, reconcile the
      // order's recorded total/walletApplied to what was actually applied.
      if (walletApplied > 0 && walletId) {
        const applied = await debitWallet(
          tx,
          walletId,
          walletApplied,
          "ONLINE_REDEEM",
          `Online order ${created.id.slice(-8).toUpperCase()}`,
          { orderId: created.id }
        );
        if (applied !== walletApplied) {
          await tx.order.update({
            where: { id: created.id },
            data: {
              walletApplied: applied,
              total: Math.max(0, totalBeforeWallet - applied),
            },
          });
          created.walletApplied = applied;
          created.total = Math.max(0, totalBeforeWallet - applied);
        }
      }

      // Count the redemption — only for an entered code, not the auto tier
      // (which applies to every order and shouldn't burn a usage limit).
      if (usedCodeId) {
        await tx.coupon.update({
          where: { id: usedCodeId },
          data: { timesUsed: { increment: 1 } },
        });
      }

      return created;
    });

    // Email order confirmation — fire-and-forget, never blocks the response.
    // ONLINE (prepaid) orders are confirmed from the PayU callback once payment
    // is actually captured, so only COD acknowledges at placement here.
    if (email && paymentMethod === "COD") {
      notifyOnlineOrderPlaced(email, {
        orderId: order.id,
        orderNumber: order.id.slice(-8).toUpperCase(),
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        total: order.total,
        itemCount: items.length,
      }).catch(() => {});
    }
    // Deliver the tax-invoice PDF for COD at placement (prepaid is delivered from
    // the PayU callback once payment is captured). Fire-and-forget.
    if (paymentMethod === "COD") {
      void sendOrderBill(order.id).catch((err) => console.error("[Bill] COD delivery failed:", err));
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.id.slice(-8).toUpperCase(),
      discount: discountFromPoints + couponDiscount,
      couponDiscount,
      pointsRedeemed: pointsToBurn,
      walletApplied: order.walletApplied,
      total: order.total,
    });
  } catch (error) {
    console.error("[orders POST]", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

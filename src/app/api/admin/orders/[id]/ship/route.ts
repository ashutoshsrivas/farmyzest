import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookShipment, isQuikShipxConfigured, quikShipxMissing, type ShipmentOverrides } from "@/lib/quikshipx";

// POST /api/admin/orders/[id]/ship — book a courier shipment for this order via
// QuikShipX and record the result on the order's Shipment row. ADMIN only.
const bodySchema = z.object({
  weightGrams: z.union([z.string(), z.number()]).optional(),
  lengthCm: z.union([z.string(), z.number()]).optional(),
  widthCm: z.union([z.string(), z.number()]).optional(),
  heightCm: z.union([z.string(), z.number()]).optional(),
  packageType: z.enum(["1", "2"]).optional(),
  shippingMode: z.enum(["1", "2"]).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isQuikShipxConfigured()) {
    return NextResponse.json(
      { error: `Delivery API not configured yet — missing ${quikShipxMissing().join(", ")} on the server.` },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  let overrides: ShipmentOverrides = {};
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (parsed.success) overrides = parsed.data;
  } catch {
    /* empty body is fine — use defaults */
  }

  const order = await db.order.findUnique({ where: { id }, include: { items: true, shipment: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.shipment?.trackingNumber) {
    return NextResponse.json(
      { error: `Already booked (AWB ${order.shipment.trackingNumber}).` },
      { status: 409 }
    );
  }
  if (!order.shippingAddress && !order.billingAddress) {
    return NextResponse.json({ error: "Order has no delivery address." }, { status: 400 });
  }
  if (!(order.shippingPincode || order.billingPincode)) {
    return NextResponse.json({ error: "Order has no delivery pincode." }, { status: 400 });
  }

  const result = await bookShipment(order, overrides);
  if (!result.ok) {
    console.error("[QuikShipX book]", order.id, result.error, result.raw ?? "");
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Record the booking on the order's Shipment row (create or update).
  const shipment = await db.shipment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      courier: "QuikShipX",
      trackingNumber: result.awb,
      trackingUrl: result.trackingUrl,
      status: "PENDING",
    },
    update: {
      courier: "QuikShipX",
      trackingNumber: result.awb,
      trackingUrl: result.trackingUrl,
    },
  });

  return NextResponse.json({
    success: true,
    awb: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
  });
}

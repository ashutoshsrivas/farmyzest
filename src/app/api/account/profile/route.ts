import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().max(40).optional().nullable(),
});

// Returns the logged-in customer's saved details + their most recent shipping
// address, for prefilling checkout. 401 for guests.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, lastOrder] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true } }),
    db.order.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        shippingName: true, shippingPhone: true,
        shippingAddress: true, shippingCity: true, shippingState: true, shippingPincode: true,
        billingAddress: true, billingCity: true, billingState: true, billingPincode: true,
      },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    name: user.name ?? "",
    email: user.email,
    phone: user.phone || lastOrder?.shippingPhone || "",
    address: lastOrder?.shippingAddress || lastOrder?.billingAddress || "",
    city: lastOrder?.shippingCity || lastOrder?.billingCity || "",
    state: lastOrder?.shippingState || lastOrder?.billingState || "",
    pincode: lastOrder?.shippingPincode || lastOrder?.billingPincode || "",
  });
}

// Update the logged-in customer's own profile (name + phone). Email is the
// login identity and is intentionally not editable here.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const { name, phone } = parsed.data;

  const user = await db.user.update({
    where: { id: session.user.id },
    data: { name, phone: phone?.trim() || null },
    select: { name: true, email: true, phone: true },
  });
  return NextResponse.json({ success: true, user });
}

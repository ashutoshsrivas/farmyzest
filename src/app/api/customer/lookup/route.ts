import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Returning-customer autofill: given a known email or phone, return the saved
// name + last shipping details from the most recent order (or the user record),
// so checkout/POS can pre-fill. Read-only; matches on the full email or a
// 10-digit phone only.
export async function GET(req: NextRequest) {
  // Guests (unauthenticated) only ever get a name back — never a stranger's
  // saved address from a typed-in email. Staff/logged-in callers get full
  // details (POS uses this to fill a returning customer's contact info).
  const session = await auth();
  const fullDetails = !!session?.user;

  const sp = req.nextUrl.searchParams;
  const email = sp.get("email")?.trim().toLowerCase();
  const phone10 = (sp.get("phone") ?? "").replace(/\D/g, "").slice(-10);

  const or: Prisma.OrderWhereInput[] = [];
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    or.push({ billingEmail: email });
    or.push({ user: { is: { email } } });
  }
  if (phone10.length === 10) {
    or.push({ billingPhone: { endsWith: phone10 } });
    or.push({ shippingPhone: { endsWith: phone10 } });
  }
  if (or.length === 0) return NextResponse.json({ found: false });

  const order = await db.order.findFirst({
    where: { OR: or },
    orderBy: { createdAt: "desc" },
    select: {
      billingName: true, billingEmail: true, billingPhone: true,
      shippingName: true, shippingPhone: true,
      shippingAddress: true, shippingCity: true, shippingState: true, shippingPincode: true,
      billingAddress: true, billingCity: true, billingState: true, billingPincode: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  if (!order) {
    // Fall back to a registered user with no orders yet.
    if (email) {
      const u = await db.user.findUnique({ where: { email }, select: { name: true } });
      if (u) return NextResponse.json({ found: true, name: u.name ?? "" });
    }
    return NextResponse.json({ found: false });
  }

  const name = order.billingName || order.shippingName || order.user?.name || "";
  if (!fullDetails) return NextResponse.json({ found: true, name });

  return NextResponse.json({
    found: true,
    name,
    email: order.billingEmail || order.user?.email || email || "",
    phone: order.billingPhone || order.shippingPhone || order.user?.phone || "",
    address: order.shippingAddress || order.billingAddress || "",
    city: order.shippingCity || order.billingCity || "",
    state: order.shippingState || order.billingState || "",
    pincode: order.shippingPincode || order.billingPincode || "",
  });
}

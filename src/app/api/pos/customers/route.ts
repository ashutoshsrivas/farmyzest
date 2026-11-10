export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/wallet";

const POS_ROLES = new Set(["ADMIN", "POS_STAFF"]);

// Create (or fetch) a customer account from the POS when a phone search finds
// no one. Walk-ins rarely have an email, but the User row requires a unique one,
// so we synthesise a placeholder (<phone>@pos.local) when none is given. Returns
// the resolved { name, phone, email } to drop into the POS customer box.
const schema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !POS_ROLES.has(session.user.role)) {
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
    return NextResponse.json({ error: "A valid phone is required" }, { status: 400 });
  }
  const phoneNorm = normalizePhone(parsed.data.phone);
  if (phoneNorm.length < 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone" }, { status: 400 });
  }
  const name = parsed.data.name?.trim() || "Walk-in customer";

  try {
    // Already a customer with this phone? Return them (idempotent).
    const existing = await db.user.findFirst({
      where: { phone: { contains: phoneNorm } },
      select: { name: true, phone: true, email: true },
    });
    if (existing) {
      return NextResponse.json({
        name: existing.name,
        phone: existing.phone ?? phoneNorm,
        email: existing.email?.endsWith("@pos.local") ? "" : existing.email,
      });
    }

    // Resolve a unique email: use the provided one if free, else a placeholder.
    let email = parsed.data.email?.toLowerCase();
    if (email) {
      const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) email = undefined;
    }
    if (!email) email = `${phoneNorm}@pos.local`;

    const created = await db.user.create({
      data: { name, phone: phoneNorm, email, role: "CUSTOMER" },
      select: { name: true, phone: true, email: true },
    });
    return NextResponse.json(
      {
        name: created.name,
        phone: created.phone ?? phoneNorm,
        email: created.email.endsWith("@pos.local") ? "" : created.email,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[pos customers create]", err);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}

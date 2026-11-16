import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, callerIp } from "@/lib/rate-limit";

// Footer "seasonal tips" sign-up. Stores the address in Newsletter (unique by
// email); re-subscribing an existing address just re-activates it.
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export async function POST(req: NextRequest) {
  const rl = rateLimit({ key: `newsletter:${callerIp(req)}`, max: 5, windowMs: 60_000 });
  if (rl.limited) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  await db.newsletter.upsert({
    where: { email: parsed.data.email },
    update: { isActive: true },
    create: { email: parsed.data.email },
  });
  return NextResponse.json({ ok: true });
}

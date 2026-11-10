import { NextResponse } from "next/server";
import { startEmailOtp, isOtpConfigured, normalizeEmail } from "@/lib/otp";

export const dynamic = "force-dynamic";

// Light in-memory throttle so an address can't be spammed with OTPs. Per-process
// (resets on deploy); good enough alongside the per-code expiry + attempt cap.
const lastSent = new Map<string, number>();
const COOLDOWN_MS = 30_000;

export async function POST(req: Request) {
  if (!isOtpConfigured()) {
    return NextResponse.json({ error: "Email login is not configured." }, { status: 503 });
  }
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const now = Date.now();
  const prev = lastSent.get(email) ?? 0;
  if (now - prev < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
    return NextResponse.json({ error: `Please wait ${wait}s before requesting another code.` }, { status: 429 });
  }

  const res = await startEmailOtp(email);
  if (!res.ok) {
    return NextResponse.json({ error: "Couldn't send the code. Check the address and try again." }, { status: 502 });
  }
  lastSent.set(email, now);
  return NextResponse.json({ ok: true });
}

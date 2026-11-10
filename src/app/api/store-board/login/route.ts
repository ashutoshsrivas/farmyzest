export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, callerIp } from "@/lib/rate-limit";
import { STORE_BOARD_COOKIE, TTL, checkCredentials, issueToken } from "@/lib/store-board-auth";

const schema = z.object({ email: z.string().min(1), password: z.string().min(1) });

// POST → sign in to the store board. DELETE → sign out.
export async function POST(req: NextRequest) {
  const ip = callerIp(req);
  if (rateLimit({ key: `storeboard:${ip}`, max: 10, windowMs: 60_000 }).limited) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  if (!checkCredentials(parsed.data.email, parsed.data.password)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STORE_BOARD_COOKIE, issueToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STORE_BOARD_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

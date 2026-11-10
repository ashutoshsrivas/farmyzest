import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, callerIp } from "@/lib/rate-limit";

// Public endpoint — no auth. Anyone on the contact page can submit.
// We persist to db.contactMessage so admins see submissions in /admin/contact.
// If/when SES is wired this is also the right place to dispatch an email
// notification, but the persisted row remains the source of truth.

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Valid email is required").max(254),
  // Phone is optional — keep the legacy free-form input rather than forcing E.164.
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

export async function POST(req: NextRequest) {
  // 5 submissions / minute / IP — keeps a tap-happy form-submitter from
  // flooding the table without preventing a legitimate retry.
  const ip = callerIp(req);
  const rl = rateLimit({ key: `contact:${ip}`, max: 5, windowMs: 60_000 });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const created = await db.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message,
      },
      select: { id: true },
    });

    // TODO: when SES is wired, send admin notification + customer confirmation
    // from here. Wrap in try/catch — the persisted row is the source of truth
    // and we don't want a transient email failure to bubble up to the user.

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[Contact] failed to persist message:", err);
    return NextResponse.json(
      { error: "Could not save your message. Please try again." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, callerIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Public, unauthenticated storefront analytics beacon. Anonymous only — the
// body carries a random visitor id (from a first-party cookie) and the current
// path, never PII. Three actions:
//   start → open a new tab-session (returns its id)
//   page  → a client-side route change (pageviews++)
//   beat  → a heartbeat carrying foreground ms since the last beat (duration+=)
// Designed to never throw at the caller: bad input is swallowed with a 204 so a
// flaky beacon can't spam the browser console or break navigation.

const ok = (body?: Record<string, unknown>) =>
  NextResponse.json(body ?? { ok: true });
const noop = () => new NextResponse(null, { status: 204 });

function deviceFromUA(ua: string): "mobile" | "tablet" | "desktop" {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return "mobile";
  return "desktop";
}

// Reduce a raw referrer to a host (or "direct"). We never want full URLs with
// query strings landing in the table.
function refHost(ref: string | undefined, selfHost: string): string {
  if (!ref) return "direct";
  try {
    const h = new URL(ref).host;
    if (!h || h === selfHost) return "direct"; // same-site nav isn't a referral
    return h.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

const clampPath = (p: unknown): string | undefined => {
  if (typeof p !== "string") return undefined;
  return p.slice(0, 300);
};

export async function POST(req: NextRequest) {
  const ip = callerIp(req);
  // Generous: a busy tab sends a beat every ~20s plus a page event per route
  // change. 240/min/IP comfortably covers real use while blunting abuse.
  if (rateLimit({ key: `track:${ip}`, max: 240, windowMs: 60_000 }).limited) return noop();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return noop();
  }

  const action = body.t;
  const selfHost = req.headers.get("host") ?? "";

  try {
    if (action === "start") {
      const visitorId = typeof body.vid === "string" ? body.vid.slice(0, 64) : null;
      if (!visitorId) return noop();
      const path = clampPath(body.path);
      const session = await db.visitSession.create({
        data: {
          visitorId,
          landingPath: path,
          exitPath: path,
          referrer: refHost(typeof body.ref === "string" ? body.ref : undefined, selfHost),
          device: deviceFromUA(req.headers.get("user-agent") ?? ""),
          isReturning: body.returning === true,
        },
        select: { id: true },
      });
      return ok({ sid: session.id });
    }

    if (action === "page") {
      const sid = typeof body.sid === "string" ? body.sid : null;
      if (!sid) return noop();
      await db.visitSession.updateMany({
        where: { id: sid },
        data: { pageviews: { increment: 1 }, exitPath: clampPath(body.path), lastSeenAt: new Date() },
      });
      return noop();
    }

    if (action === "beat") {
      const sid = typeof body.sid === "string" ? body.sid : null;
      if (!sid) return noop();
      // Clamp the reported delta so an idle/backgrounded tab or a tampered
      // payload can't inflate time-on-site. Max one minute per beat.
      const dms = Math.max(0, Math.min(60_000, Number(body.dms) || 0));
      await db.visitSession.updateMany({
        where: { id: sid },
        data: { durationMs: { increment: dms }, lastSeenAt: new Date() },
      });
      return noop();
    }
  } catch {
    // Analytics must never surface errors to visitors.
    return noop();
  }

  return noop();
}

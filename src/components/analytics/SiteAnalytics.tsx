"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Lightweight first-party visit beacon for the storefront. Anonymous: it sends
// a random visitor id (first-party cookie) + the current path to /api/track.
// No names, emails, or query strings leave the page. Tracks time-on-site via
// heartbeats that only count while the tab is in the foreground.

const VID_COOKIE = "ss_vid";
const SID_KEY = "ss_sid"; // per-tab session id (sessionStorage)
const BEAT_MS = 20_000;

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string, days: number) {
  const exp = new Date(Date.now() + days * 86400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}
function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export function SiteAnalytics() {
  const pathname = usePathname();
  const sidRef = useRef<string | null>(null);
  const startP = useRef<Promise<string | null> | null>(null);
  const visibleSince = useRef<number | null>(null);
  const pendingMs = useRef(0);
  const firstPath = useRef(true);

  // Resolve (or lazily open) the tab-session id.
  const ready = useRef<() => Promise<string | null>>(async () => null);

  useEffect(() => {
    // Don't track obvious automation.
    if (typeof navigator !== "undefined" && (navigator as { webdriver?: boolean }).webdriver) return;

    let stopped = false;

    // Visitor id (persistent, anonymous). returning = cookie already existed.
    let vid = readCookie(VID_COOKIE);
    const returning = !!vid;
    if (!vid) {
      vid = uid();
      writeCookie(VID_COOKIE, vid, 365);
    }

    function post(body: Record<string, unknown>, beacon = false) {
      const json = JSON.stringify(body);
      if (beacon && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/track", new Blob([json], { type: "application/json" }));
        return;
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
        keepalive: true,
      }).catch(() => {});
    }

    async function doStart(): Promise<string | null> {
      // Reuse an existing per-tab session if the component remounts.
      const existing = sessionStorage.getItem(SID_KEY);
      if (existing) {
        sidRef.current = existing;
        return existing;
      }
      try {
        const res = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: "start", vid, path: location.pathname, ref: document.referrer, returning }),
          keepalive: true,
        });
        const d = await res.json().catch(() => null);
        const sid = d?.sid ?? null;
        if (sid) {
          sidRef.current = sid;
          sessionStorage.setItem(SID_KEY, sid);
        }
        return sid;
      } catch {
        return null;
      }
    }

    ready.current = async () => {
      if (sidRef.current) return sidRef.current;
      if (!startP.current) startP.current = doStart();
      return startP.current;
    };

    function accumulate() {
      if (visibleSince.current != null) {
        const now = Date.now();
        pendingMs.current += now - visibleSince.current;
        visibleSince.current = now;
      }
    }
    async function flush(beacon = false) {
      accumulate();
      const dms = pendingMs.current;
      if (dms < 1000) return; // ignore sub-second noise
      pendingMs.current = 0;
      const sid = await ready.current();
      if (sid && !stopped) post({ t: "beat", sid, dms }, beacon);
    }

    // Begin counting if we're already visible, and open the session.
    visibleSince.current = document.visibilityState === "visible" ? Date.now() : null;
    ready.current();

    const interval = setInterval(() => flush(false), BEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush(true); // flush time before the tab is frozen
        visibleSince.current = null;
      } else {
        visibleSince.current = Date.now();
      }
    };
    const onHide = () => flush(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change → a new pageview. The first render is the landing page, which
  // the "start" event already counts, so skip it here.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    (async () => {
      const sid = await ready.current();
      if (!sid) return;
      navigator.sendBeacon?.(
        "/api/track",
        new Blob([JSON.stringify({ t: "page", sid, path: pathname })], { type: "application/json" })
      ) ||
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: "page", sid, path: pathname }),
          keepalive: true,
        }).catch(() => {});
    })();
  }, [pathname]);

  return null;
}

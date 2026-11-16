"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SEGMENT_COOKIE, SEGMENT_STORAGE_KEY, parseSegment, type Segment } from "@/lib/segment";

interface SegmentCtx {
  segment: Segment;
  /** Switch segment. Pass `{ refresh: false }` when a navigation follows anyway. */
  setSegment: (s: Segment, opts?: { refresh?: boolean }) => void;
}

const Ctx = createContext<SegmentCtx>({ segment: "garden", setSegment: () => {} });

export const useSegment = () => useContext(Ctx);

function persist(s: Segment) {
  document.cookie = `${SEGMENT_COOKIE}=${s}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(SEGMENT_STORAGE_KEY, s);
  } catch {
    /* storage blocked — the cookie is enough */
  }
}

/**
 * Holds the Garden/Farm choice and renders the storefront root with
 * `data-segment`, which swaps the accent tokens in globals.css. Server
 * components re-render via router.refresh() so menus and ordering follow.
 */
export function SegmentProvider({
  initial,
  hasCookie,
  className,
  children,
}: {
  initial: Segment;
  hasCookie: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [segment, setState] = useState<Segment>(initial);

  const setSegment = useCallback(
    (s: Segment, opts?: { refresh?: boolean }) => {
      setState(s);
      persist(s);
      if (opts?.refresh !== false) router.refresh();
    },
    [router]
  );

  // A returning shopper whose cookie was cleared: restore from localStorage.
  useEffect(() => {
    if (hasCookie) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SEGMENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // One-time sync from an external store on mount (cookie missing), not a
    // render loop: the server could not know this value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && parseSegment(stored) !== initial) setSegment(parseSegment(stored));
  }, [hasCookie, initial, setSegment]);

  return (
    <Ctx.Provider value={{ segment, setSegment }}>
      <div data-segment={segment} className={className}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

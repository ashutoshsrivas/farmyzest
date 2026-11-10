"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Date-range selector for a salesman's earnings summary. Writes ?from&to into
// the URL; the server page re-reads them and scopes Total Earned / Paid /
// Pending / POS Sales to the window. Empty range = all-time (the default).

const ymd = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function EarningsRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(next: { from?: string; to?: string }) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function preset(kind: "thisMonth" | "lastMonth" | "last30" | "all") {
    if (kind === "all") return apply({ from: "", to: "" });
    const now = new Date();
    let start: Date;
    let end: Date;
    if (kind === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    } else if (kind === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      start = new Date(now);
      start.setDate(start.getDate() - 29);
      end = now;
    }
    apply({ from: ymd(start), to: ymd(end) });
  }

  const btn =
    "text-xs px-2.5 py-1 rounded-md border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100 transition-colors";
  const inputCls =
    "text-xs px-2 py-1 rounded-md border border-nate-grey-200 focus:outline-none focus:ring-1 focus:ring-nate-grey-400";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-nate-grey-500">From</label>
        <input type="date" value={from} max={to || undefined} onChange={(e) => apply({ from: e.target.value })} className={inputCls} />
        <label className="text-xs text-nate-grey-500">To</label>
        <input type="date" value={to} min={from || undefined} onChange={(e) => apply({ to: e.target.value })} className={inputCls} />
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => preset("thisMonth")} className={btn}>This month</button>
        <button type="button" onClick={() => preset("lastMonth")} className={btn}>Last month</button>
        <button type="button" onClick={() => preset("last30")} className={btn}>Last 30 days</button>
        <button type="button" onClick={() => preset("all")} className={btn}>All time</button>
      </div>
    </div>
  );
}

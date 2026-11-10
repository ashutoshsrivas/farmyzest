"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Search, X } from "lucide-react";

// All filters are URL-driven so the active state is shareable / bookmarkable
// and the server component reads them directly. The Export CSV button just
// rewrites the same query string against /api/admin/orders/export so the
// download honours whatever filters are visible on screen.

const statuses = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

export function OrdersFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local mirror for date inputs so typing doesn't immediately blast the
  // server with a request per keystroke. We commit on blur / Enter.
  const [fromLocal, setFromLocal] = useState(searchParams.get("from") ?? "");
  const [toLocal, setToLocal] = useState(searchParams.get("to") ?? "");

  // Search box: mirror locally and debounce-push so the list filters as you
  // type without a request per keystroke.
  const [qLocal, setQLocal] = useState(searchParams.get("q") ?? "");
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (qLocal.trim() === current) return;
    const t = setTimeout(() => update({ q: qLocal.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v.length > 0) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // reset pagination when filters change
    router.push(`/admin/orders?${params.toString()}`);
  }

  function reset() {
    setFromLocal("");
    setToLocal("");
    setQLocal("");
    router.push("/admin/orders");
  }

  // Quick period selector. Picking a range clears any custom from/to.
  const RANGES: { k: string; label: string }[] = [
    { k: "today", label: "Today" },
    { k: "7d", label: "7 days" },
    { k: "30d", label: "30 days" },
    { k: "all", label: "All time" },
  ];
  const isCustomPeriod = !!(searchParams.get("from") || searchParams.get("to"));
  // Default period is Today when nothing is set and no custom dates are active.
  const activeRange = isCustomPeriod ? "" : searchParams.get("range") || "today";

  function pickRange(k: string) {
    setFromLocal("");
    setToLocal("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", k);
    params.delete("from");
    params.delete("to");
    params.delete("page");
    router.push(`/admin/orders?${params.toString()}`);
  }

  function exportCsv() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    window.location.href = `/api/admin/orders/export?${params.toString()}`;
  }

  const filterCount = ["status", "source", "from", "to", "q"].filter((k) =>
    searchParams.get(k)
  ).length;

  return (
    <div className="bg-white rounded-xl p-4 mb-6">
      {/* Quick period — controls both the table and the sales summary. */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium mr-1">
          Period
        </span>
        <div className="inline-flex rounded-lg border border-nate-grey-200 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.k}
              type="button"
              onClick={() => pickRange(r.k)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                activeRange === r.k
                  ? "bg-nate-grey-800 text-white"
                  : "bg-white text-nate-grey-600 hover:bg-nate-grey-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {isCustomPeriod && (
          <span className="text-xs text-nate-grey-400">custom dates below</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-60">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
            <input
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update({ q: qLocal.trim() || null });
              }}
              placeholder="Name, order ID, phone, or email…"
              className="w-full pl-9 pr-9 py-2 text-sm border border-nate-grey-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
            />
            {qLocal && (
              <button
                type="button"
                onClick={() => setQLocal("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-nate-grey-400 hover:text-nate-grey-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">
            Status
          </label>
          <select
            className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400 min-w-36"
            value={searchParams.get("status") || ""}
            onChange={(e) => update({ status: e.target.value || null })}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">
            Source
          </label>
          <select
            className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400 min-w-32"
            value={searchParams.get("source") || ""}
            onChange={(e) => update({ source: e.target.value || null })}
          >
            <option value="">All sources</option>
            <option value="ONLINE">Online</option>
            <option value="POS">POS</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">
            From
          </label>
          <input
            type="date"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            onBlur={() => update({ from: fromLocal || null })}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ from: fromLocal || null });
            }}
            className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">
            To
          </label>
          <input
            type="date"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            onBlur={() => update({ to: toLocal || null })}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ to: toLocal || null });
            }}
            className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {filterCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-sm text-nate-grey-500 hover:text-nate-grey-800 px-3 py-2"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

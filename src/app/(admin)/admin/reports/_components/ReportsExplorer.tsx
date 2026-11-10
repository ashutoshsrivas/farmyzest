"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, BarChart3 } from "lucide-react";

// ── Report registry (keys must match the API's ReportType) ──────────────────────
// timeRanged=false reports are point-in-time snapshots; the date picker is hidden.

interface ReportDef { key: string; label: string; timeRanged?: boolean }
interface ReportGroup { group: string; items: ReportDef[] }

const REPORTS: ReportGroup[] = [
  {
    group: "Sales & Money",
    items: [
      { key: "sales-summary", label: "Sales Summary", timeRanged: true },
      { key: "pnl", label: "Profit & Loss", timeRanged: true },
      { key: "payments", label: "Payment Methods", timeRanged: true },
      { key: "gst", label: "GST Summary", timeRanged: true },
      { key: "credit", label: "Credit / Receivables" },
      { key: "wallet", label: "Store Credit (Wallets)" },
    ],
  },
  {
    group: "Products",
    items: [
      { key: "category-sales", label: "Sales by Category", timeRanged: true },
      { key: "product-sales", label: "Sales by Product", timeRanged: true },
      { key: "brand-sales", label: "Sales by Brand", timeRanged: true },
      { key: "stock", label: "Stock Valuation" },
      { key: "low-stock", label: "Low / Out of Stock" },
      { key: "catalog", label: "Product Catalog" },
    ],
  },
  {
    group: "People",
    items: [
      { key: "salesman", label: "Salesman Performance", timeRanged: true },
      { key: "customers", label: "Customers", timeRanged: true },
    ],
  },
  {
    group: "Operations",
    items: [
      { key: "purchases", label: "Purchases (Suppliers)", timeRanged: true },
      { key: "goods-returns", label: "Goods Returns", timeRanged: true },
      { key: "exchanges", label: "Exchanges", timeRanged: true },
      { key: "coupons", label: "Coupons", timeRanged: true },
    ],
  },
];

type ColType = "text" | "number" | "money" | "percent" | "date" | "datetime";
type Cell = string | number | null;
interface Column { key: string; label: string; type?: ColType }
interface Report {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function todayIso() {
  return new Date().toISOString().split("T")[0];
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function fmt(v: Cell, type?: ColType): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    if (type === "money") return inr(v);
    if (type === "percent") return v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "%";
    if (type === "number") return v.toLocaleString("en-IN");
  }
  if (type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return String(v);
}

function alignFor(type?: ColType) {
  return type === "money" || type === "number" || type === "percent" ? "text-right" : "text-left";
}

export function ReportsExplorer() {
  const [active, setActive] = useState("sales-summary");
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = useMemo(() => REPORTS.flatMap((g) => g.items).find((i) => i.key === active)!, [active]);
  const timeRanged = !!def.timeRanged;

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ type: active });
    if (timeRanged) { p.set("from", from); p.set("to", to); }
    return p.toString();
  }, [active, from, to, timeRanged]);

  // Fetch whenever the report or range changes. Inlined async IIFE with a
  // cancellation flag so a slow earlier request can't overwrite a newer one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/reports?${queryString}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to load report");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load report");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryString]);

  const download = () => {
    const a = document.createElement("a");
    a.href = `/api/admin/reports?${queryString}&format=csv`;
    a.download = "";
    a.click();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar: report picker */}
      <aside className="lg:w-60 shrink-0">
        <div className="bg-white rounded-xl border border-nate-grey-200 p-2 lg:sticky lg:top-4">
          {REPORTS.map((grp) => (
            <div key={grp.group} className="mb-2 last:mb-0">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-nate-grey-400 font-semibold">{grp.group}</p>
              {grp.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => setActive(it.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    active === it.key ? "bg-nate-grey-800 text-white" : "text-nate-grey-600 hover:bg-nate-grey-100"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 mb-5">
          {timeRanged && (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">From</label>
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                  className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">To</label>
                <input type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)}
                  className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400" />
              </div>
              <div className="flex gap-1">
                {[
                  { label: "7d", days: 7 },
                  { label: "30d", days: 30 },
                  { label: "90d", days: 90 },
                  { label: "1y", days: 365 },
                ].map((q) => (
                  <button key={q.label} onClick={() => { setFrom(isoDaysAgo(q.days)); setTo(todayIso()); }}
                    className="px-2.5 py-2 text-xs text-nate-grey-600 border border-nate-grey-200 rounded-lg hover:bg-nate-grey-100">
                    {q.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="ml-auto">
            <button onClick={download} disabled={!data || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50">
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-xl border border-nate-grey-200 p-16 flex items-center justify-center text-nate-grey-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && data && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-nate-grey-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-nate-grey-400" /> {data.title}
              </h2>
              {data.subtitle && <p className="text-xs text-nate-grey-500 mt-0.5">{data.subtitle}</p>}
            </div>

            {data.summary && data.summary.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {data.summary.map((s) => (
                  <div key={s.label} className="bg-white rounded-xl border border-nate-grey-200 p-4">
                    <p className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{s.label}</p>
                    <p className="font-serif text-xl tabular-nums text-nate-grey-900 mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl border border-nate-grey-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-nate-grey-50 border-b border-nate-grey-100">
                      {data.columns.map((c) => (
                        <th key={c.key} className={`px-4 py-3 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide whitespace-nowrap ${alignFor(c.type)}`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nate-grey-100">
                    {data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={data.columns.length} className="px-4 py-12 text-center text-nate-grey-400">
                          No data for this range.
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-nate-grey-50">
                          {data.columns.map((c) => (
                            <td key={c.key} className={`px-4 py-2.5 text-nate-grey-700 whitespace-nowrap tabular-nums ${alignFor(c.type)}`}>
                              {fmt(row[c.key], c.type)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.totals && data.rows.length > 0 && (
                    <tfoot>
                      <tr className="bg-nate-grey-50 border-t-2 border-nate-grey-200 font-semibold text-nate-grey-800">
                        {data.columns.map((c) => (
                          <td key={c.key} className={`px-4 py-3 whitespace-nowrap tabular-nums ${alignFor(c.type)}`}>
                            {fmt(data.totals![c.key], c.type)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {data.rows.length > 0 && (
              <p className="text-xs text-nate-grey-400 mt-3">{data.rows.length} row{data.rows.length === 1 ? "" : "s"}.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

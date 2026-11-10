"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// Client-side customers table with a filter for every column plus a loyalty
// points RANGE (min–max). The server hands over the full, already-reconciled
// row list (accounts + guests); all filtering / sorting / paging happens here so
// it's instant and the loyalty range can be scrubbed without a round-trip.

export type CustomerRow = {
  kind: "account" | "guest";
  id?: string;
  phone: string | null;
  name: string;
  email: string | null;
  orders: number;
  spent: number;
  points: number | null;
  isActive: boolean;
  lastActivity: number;
};

type SortKey = "name" | "orders" | "spent" | "points" | "lastActivity";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;
const digits = (s: string) => s.replace(/\D/g, "");

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"all" | "account" | "guest">("all");
  const [phone, setPhone] = useState("");
  const [ordersMin, setOrdersMin] = useState("");
  const [spentMin, setSpentMin] = useState("");
  const [spentMax, setSpentMax] = useState("");
  const [pointsMin, setPointsMin] = useState("");
  const [pointsMax, setPointsMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastActivity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const nName = name.trim().toLowerCase();
    const nPhone = digits(phone);
    const oMin = ordersMin ? parseInt(ordersMin, 10) : null;
    const sMin = spentMin ? parseFloat(spentMin) : null;
    const sMax = spentMax ? parseFloat(spentMax) : null;
    const pMin = pointsMin ? parseFloat(pointsMin) : null;
    const pMax = pointsMax ? parseFloat(pointsMax) : null;
    const pointsFilterActive = pMin != null || pMax != null;

    const out = rows.filter((r) => {
      if (nName && !(r.name.toLowerCase().includes(nName) || (r.email ?? "").toLowerCase().includes(nName))) return false;
      if (type !== "all" && r.kind !== type) return false;
      if (nPhone && !digits(r.phone ?? "").includes(nPhone)) return false;
      if (oMin != null && r.orders < oMin) return false;
      if (sMin != null && r.spent < sMin) return false;
      if (sMax != null && r.spent > sMax) return false;
      if (pointsFilterActive) {
        // Guests have no loyalty account (points null) — a points range hides them.
        if (r.points == null) return false;
        if (pMin != null && r.points < pMin) return false;
        if (pMax != null && r.points > pMax) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortKey === "points") { av = a.points ?? -1; bv = b.points ?? -1; }
      else { av = a[sortKey] as number; bv = b[sortKey] as number; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return out;
  }, [rows, name, type, phone, ordersMin, spentMin, spentMax, pointsMin, pointsMax, sortKey, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
    setPage(1);
  }
  // Any filter change resets to page 1.
  const onFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const hasFilters =
    name || type !== "all" || phone || ordersMin || spentMin || spentMax || pointsMin || pointsMax;

  function clearAll() {
    setName(""); setType("all"); setPhone("");
    setOrdersMin(""); setSpentMin(""); setSpentMax(""); setPointsMin(""); setPointsMax("");
    setPage(1);
  }

  const th = "text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide";
  const filterInput = "w-full px-2 py-1 text-xs rounded border border-nate-grey-200 focus:outline-none focus:ring-1 focus:ring-accent/50";

  // Plain render helper (not a component) so header state isn't reset each render.
  const sortIcon = (k: SortKey) =>
    sortKey !== k ? <ArrowUpDown className="w-3 h-3 opacity-40" /> : sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-nate-grey-100 text-sm text-nate-grey-500">
        <span>{total} matching</span>
        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-accent hover:underline">Clear filters</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-nate-grey-50 border-b border-nate-grey-200">
            <tr>
              <th className={th}>
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 uppercase">Customer {sortIcon("name")}</button>
              </th>
              <th className={th}>Type</th>
              <th className={th}>Phone</th>
              <th className={`${th} text-right`}>
                <button onClick={() => toggleSort("orders")} className="flex items-center gap-1 uppercase ml-auto">Orders {sortIcon("orders")}</button>
              </th>
              <th className={`${th} text-right`}>
                <button onClick={() => toggleSort("spent")} className="flex items-center gap-1 uppercase ml-auto">Spent {sortIcon("spent")}</button>
              </th>
              <th className={`${th} text-right`}>
                <button onClick={() => toggleSort("points")} className="flex items-center gap-1 uppercase ml-auto">Points {sortIcon("points")}</button>
              </th>
              <th className="px-6 py-3"></th>
            </tr>
            {/* Filter row */}
            <tr className="bg-white border-b border-nate-grey-100">
              <th className="px-6 py-2">
                <input value={name} onChange={(e) => onFilter(setName)(e.target.value)} placeholder="Name / email…" className={filterInput} />
              </th>
              <th className="px-6 py-2">
                <select value={type} onChange={(e) => onFilter(setType)(e.target.value as "all" | "account" | "guest")} className={filterInput}>
                  <option value="all">All</option>
                  <option value="account">Account</option>
                  <option value="guest">Guest / POS</option>
                </select>
              </th>
              <th className="px-6 py-2">
                <input value={phone} onChange={(e) => onFilter(setPhone)(e.target.value)} placeholder="Phone…" inputMode="numeric" className={filterInput} />
              </th>
              <th className="px-6 py-2">
                <input value={ordersMin} onChange={(e) => onFilter(setOrdersMin)(e.target.value)} placeholder="min" inputMode="numeric" className={`${filterInput} text-right`} />
              </th>
              <th className="px-6 py-2">
                <div className="flex items-center gap-1">
                  <input value={spentMin} onChange={(e) => onFilter(setSpentMin)(e.target.value)} placeholder="min" inputMode="numeric" className={`${filterInput} text-right`} />
                  <input value={spentMax} onChange={(e) => onFilter(setSpentMax)(e.target.value)} placeholder="max" inputMode="numeric" className={`${filterInput} text-right`} />
                </div>
              </th>
              <th className="px-6 py-2">
                <div className="flex items-center gap-1">
                  <input value={pointsMin} onChange={(e) => onFilter(setPointsMin)(e.target.value)} placeholder="min" inputMode="numeric" className={`${filterInput} text-right`} />
                  <input value={pointsMax} onChange={(e) => onFilter(setPointsMax)(e.target.value)} placeholder="max" inputMode="numeric" className={`${filterInput} text-right`} />
                </div>
              </th>
              <th className="px-6 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-nate-grey-500">No customers match these filters.</td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const href =
                  r.kind === "account"
                    ? `/admin/customers/${r.id}`
                    : `/admin/customers/guest/${encodeURIComponent(r.phone ?? "")}`;
                return (
                  <tr key={`${r.kind}-${r.id ?? r.phone}`} className="hover:bg-nate-grey-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-nate-grey-800 flex items-center gap-2">
                        {r.name}
                        {!r.isActive && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700">Inactive</span>
                        )}
                      </p>
                      {r.email && <p className="text-xs text-nate-grey-500">{r.email}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.kind === "account" ? "bg-green-100 text-green-700" : "bg-nate-grey-100 text-nate-grey-600"}`}>
                        {r.kind === "account" ? "Account" : "Guest / POS"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-nate-grey-600">{r.phone || "—"}</td>
                    <td className="px-6 py-4 text-right text-nate-grey-700 tabular-nums">{r.orders}</td>
                    <td className="px-6 py-4 text-right text-nate-grey-800 font-medium tabular-nums">
                      ₹{r.spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-right text-nate-grey-700 tabular-nums">
                      {r.points == null ? "—" : Math.round(r.points)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={href} className="text-xs px-3 py-1.5 rounded-md bg-nate-grey-800 text-white hover:bg-nate-grey-700 transition-colors font-medium">
                        {r.kind === "account" ? "Manage" : "View"}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-nate-grey-100 text-sm">
          <span className="text-nate-grey-500">
            Page {clampedPage} of {totalPages} · {total} customer{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage <= 1} className="text-xs px-3 py-1.5 rounded-md border border-nate-grey-200 disabled:opacity-40 hover:bg-nate-grey-100">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage >= totalPages} className="text-xs px-3 py-1.5 rounded-md border border-nate-grey-200 disabled:opacity-40 hover:bg-nate-grey-100">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

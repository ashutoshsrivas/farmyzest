"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, ShoppingBag } from "lucide-react";

interface Row {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  date: string;
  source: string;
  role: string; // "Attended" | "Billed"
  customer: string;
  customerPhone: string;
  productSummary: string;
  itemCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-orange-100 text-orange-800",
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SalesmanOrdersModal({
  salesmanId,
  salesmanName,
}: {
  salesmanId: string;
  salesmanName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/admin/salesmen/${salesmanId}/orders?${qs.toString()}`);
      const d = res.ok ? await res.json() : null;
      setRows(d?.orders ?? []);
      setCount(d?.count ?? 0);
      setTotalAmount(d?.totalAmount ?? 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [salesmanId, from, to]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-nate-grey-900 text-white hover:bg-black transition-colors"
      >
        <ShoppingBag className="w-4 h-4" /> View Orders
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full max-w-5xl rounded-xl shadow-xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100 sticky top-0 bg-white rounded-t-xl">
              <div>
                <h2 className="font-serif text-lg text-nate-grey-900">Orders — {salesmanName}</h2>
                <p className="text-xs text-nate-grey-500 mt-0.5">
                  Orders billed or attended by this salesman. Click a row to open it.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-nate-grey-400 hover:text-nate-grey-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date range */}
            <div className="px-6 py-3 border-b border-nate-grey-100 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-nate-grey-400 mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-nate-grey-400 mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent"
                />
              </div>
              {(from || to) && (
                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className="text-sm text-nate-grey-500 hover:text-nate-grey-800 px-2 py-1.5"
                >
                  Clear
                </button>
              )}
              <div className="ml-auto text-sm text-nate-grey-600">
                <span className="font-semibold text-nate-grey-900">{count}</span> orders ·{" "}
                <span className="font-semibold text-nate-grey-900">{inr(totalAmount)}</span>
              </div>
            </div>

            {/* Table */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-nate-grey-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading…
                </div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center text-nate-grey-400 text-sm">No orders in this range.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-nate-grey-50 text-[10px] uppercase tracking-wider text-nate-grey-500 sticky top-0">
                    <tr>
                      <th className="text-left px-6 py-3">Order</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-left px-4 py-3">Products</th>
                      <th className="text-right px-4 py-3">Amount</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-6 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nate-grey-100">
                    {rows.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/admin/orders/${o.id}`)}
                        className="cursor-pointer hover:bg-nate-grey-50"
                      >
                        <td className="px-6 py-3 font-mono text-xs text-nate-grey-700">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-nate-grey-600 whitespace-nowrap">{fmtDate(o.date)}</td>
                        <td className="px-4 py-3 text-nate-grey-800">
                          {o.customer}
                          {o.customerPhone ? <span className="block text-xs text-nate-grey-400">{o.customerPhone}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-nate-grey-600">
                          {o.productSummary}
                          <span className="block text-xs text-nate-grey-400">{o.itemCount} item{o.itemCount === 1 ? "" : "s"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-nate-grey-900 whitespace-nowrap">{inr(o.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-nate-grey-100 text-nate-grey-600"}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-nate-grey-500">{o.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

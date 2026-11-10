"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, PackageOpen, Truck, ShoppingBag } from "lucide-react";

interface Purchase {
  itemId: string;
  billId: string;
  billNumber: string;
  refBillNo: string | null;
  supplier: string;
  date: string;
  description: string;
  quantity: number;
  freeQuantity: number;
  unitCost: number;
  amount: number;
}
interface Sale {
  itemId: string;
  orderId: string;
  orderNumber: string;
  source: "ONLINE" | "POS";
  status: string;
  date: string;
  customer: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
interface Ledger {
  purchases: Purchase[];
  sales: Sale[];
  summary: {
    purchasedQty: number;
    purchaseValue: number;
    soldQty: number;
    salesValue: number;
    purchaseBills: number;
    salesOrders: number;
  };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-orange-100 text-orange-700",
};

export function ProductLedger({ productId }: { productId: string }) {
  const [data, setData] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/products/${productId}/ledger`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [productId]);

  return (
    <div className="bg-white rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <PackageOpen className="w-5 h-5 text-nate-grey-500" />
        <h2 className="text-lg font-medium text-nate-grey-800">Stock Ledger &amp; History</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-nate-grey-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading history…
        </div>
      ) : !data ? (
        <p className="py-8 text-center text-sm text-nate-grey-400">Couldn&apos;t load history.</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Purchased In" value={`${data.summary.purchasedQty} pcs`} sub={`${data.summary.purchaseBills} bill${data.summary.purchaseBills === 1 ? "" : "s"} · ${inr(data.summary.purchaseValue)}`} tone="blue" icon={ArrowDownToLine} />
            <Metric label="Sold Out" value={`${data.summary.soldQty} pcs`} sub={`${data.summary.salesOrders} order${data.summary.salesOrders === 1 ? "" : "s"} · ${inr(data.summary.salesValue)}`} tone="green" icon={ArrowUpFromLine} />
            <Metric label="Net Movement" value={`${data.summary.purchasedQty - data.summary.soldQty} pcs`} sub="purchased − sold" tone="grey" icon={PackageOpen} />
            <Metric label="Realised Value" value={inr(data.summary.salesValue)} sub={`cost in ${inr(data.summary.purchaseValue)}`} tone="amber" icon={ShoppingBag} />
          </div>

          {/* Two columns: purchases (in) | sales (out) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Purchases */}
            <div className="border border-nate-grey-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                <Truck className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Purchased from (supplier bills)</span>
                <span className="ml-auto text-xs text-blue-600">{data.purchases.length}</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {data.purchases.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-nate-grey-400">Not added from any supplier bill yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-nate-grey-50 sticky top-0">
                      <tr className="text-[10px] uppercase tracking-wide text-nate-grey-500">
                        <th className="text-left px-4 py-2 font-medium">Bill</th>
                        <th className="text-left px-3 py-2 font-medium">Supplier</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-right px-4 py-2 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nate-grey-100">
                      {data.purchases.map((p) => (
                        <tr key={p.itemId} className="hover:bg-nate-grey-50">
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/purchases/${p.billId}`} className="font-mono text-xs text-accent hover:underline">
                              {p.billNumber}
                            </Link>
                            <span className="block text-[11px] text-nate-grey-400">{fmtDate(p.date)}{p.refBillNo ? ` · ${p.refBillNo}` : ""}</span>
                          </td>
                          <td className="px-3 py-2.5 text-nate-grey-700">{p.supplier}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-nate-grey-700">
                            {p.quantity}
                            {p.freeQuantity > 0 ? <span className="text-green-600"> +{p.freeQuantity}</span> : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-nate-grey-700">{inr(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Sales */}
            <div className="border border-nate-grey-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border-b border-green-100">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Sold on (orders &amp; bills)</span>
                <span className="ml-auto text-xs text-green-600">{data.sales.length}</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {data.sales.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-nate-grey-400">Not sold on any order yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-nate-grey-50 sticky top-0">
                      <tr className="text-[10px] uppercase tracking-wide text-nate-grey-500">
                        <th className="text-left px-4 py-2 font-medium">Order</th>
                        <th className="text-left px-3 py-2 font-medium">Customer</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-right px-4 py-2 font-medium">Sold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nate-grey-100">
                      {data.sales.map((s) => (
                        <tr key={s.itemId} className="hover:bg-nate-grey-50">
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/orders/${s.orderId}`} className="font-mono text-xs text-accent hover:underline">
                              {s.orderNumber}
                            </Link>
                            <span className="mt-0.5 flex items-center gap-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${s.source === "POS" ? "bg-amber-100 text-amber-700" : "bg-nate-grey-200 text-nate-grey-600"}`}>
                                {s.source === "POS" ? "POS" : "Online"}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? "bg-nate-grey-100 text-nate-grey-600"}`}>
                                {s.status.replace(/_/g, " ")}
                              </span>
                            </span>
                            <span className="block text-[11px] text-nate-grey-400 mt-0.5">{fmtDate(s.date)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-nate-grey-700">
                            {s.customer}
                            {s.variantLabel ? <span className="block text-[11px] text-nate-grey-400">{s.variantLabel}</span> : null}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-nate-grey-700">{s.quantity}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-nate-grey-700">{inr(s.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "blue" | "green" | "grey" | "amber";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const accent =
    tone === "blue" ? "text-blue-600" : tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : "text-nate-grey-800";
  return (
    <div className="rounded-lg border border-nate-grey-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{label}</p>
        <Icon className={`w-4 h-4 ${accent} opacity-70`} />
      </div>
      <p className={`font-serif text-xl tabular-nums mt-1 ${accent}`}>{value}</p>
      <p className="text-[11px] text-nate-grey-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

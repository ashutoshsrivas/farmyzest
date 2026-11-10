import { TrendingUp, Globe, Store, ShoppingCart } from "lucide-react";

const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

export interface OrdersSummaryData {
  totalSales: number;
  totalCount: number;
  onlineSales: number;
  onlineCount: number;
  posSales: number;
  posCount: number;
  avgCart: number;
}

// Sales analytics strip shown above the orders table. Keys off the page's
// date range only (not the source/status table filters) so the channel split
// is always a complete picture of the period. Excludes cancelled/returned.
export function OrdersSummary({ data, rangeLabel }: { data: OrdersSummaryData; rangeLabel: string }) {
  const cards = [
    {
      label: "Total Sales",
      value: inr(data.totalSales),
      sub: `${data.totalCount} order${data.totalCount === 1 ? "" : "s"}`,
      icon: TrendingUp,
      accent: "text-nate-grey-900",
      ring: "bg-nate-grey-900",
    },
    {
      label: "Online Sales",
      value: inr(data.onlineSales),
      sub: `${data.onlineCount} order${data.onlineCount === 1 ? "" : "s"}`,
      icon: Globe,
      accent: "text-blue-600",
      ring: "bg-blue-500",
    },
    {
      label: "POS Sales",
      value: inr(data.posSales),
      sub: `${data.posCount} order${data.posCount === 1 ? "" : "s"}`,
      icon: Store,
      accent: "text-amber-600",
      ring: "bg-amber-500",
    },
    {
      label: "Avg Cart Value",
      value: inr(data.avgCart),
      sub: "per order",
      icon: ShoppingCart,
      accent: "text-green-600",
      ring: "bg-green-500",
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-nate-grey-400 font-medium">Sales overview</p>
        <p className="text-[11px] text-nate-grey-400">{rangeLabel}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="relative bg-white rounded-xl border border-nate-grey-200 p-4 overflow-hidden">
              <span className={`absolute left-0 top-0 h-full w-1 ${c.ring}`} />
              <div className="flex items-start justify-between">
                <p className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{c.label}</p>
                <Icon className={`w-4 h-4 ${c.accent} opacity-70`} />
              </div>
              <p className={`font-serif text-2xl tabular-nums mt-1 ${c.accent}`}>{c.value}</p>
              <p className="text-[11px] text-nate-grey-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

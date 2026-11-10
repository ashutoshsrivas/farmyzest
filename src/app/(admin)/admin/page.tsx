export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { onlineNotASale } from "@/lib/order-status";
import Link from "next/link";
import {
  TrendingUp,
  Banknote,
  CreditCard,
  Package,
  Warehouse,
  Receipt,
  AlertTriangle,
  ShoppingBag,
  Boxes,
  BarChart3,
  Smartphone,
  Wallet,
  Landmark,
  Globe,
} from "lucide-react";

// ── Time-range helpers ────────────────────────────────────────────────────────
// Range buttons: today, 7d, 30d, all-time. "all" keeps things scoped to
// orders that aren't cancelled/returned — we never want voided rows skewing
// revenue or profit.

type Range = "today" | "7d" | "30d" | "all";

function rangeWindow(r: Range): { gte?: Date; lt?: Date; label: string } {
  const now = new Date();
  if (r === "today") {
    // IST calendar day, not the server's UTC day — the store runs on IST, so
    // "today" must start at 00:00 IST (else early-morning-IST orders land in
    // yesterday's UTC bucket and the totals drift vs the shop's real day).
    const IST = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + IST);
    ist.setUTCHours(0, 0, 0, 0);
    const start = new Date(ist.getTime() - IST); // UTC instant of IST midnight
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { gte: start, lt: end, label: "today" };
  }
  if (r === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { gte: start, label: "last 7 days" };
  }
  if (r === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { gte: start, label: "last 30 days" };
  }
  return { label: "all time" };
}

// ── Currency formatter — Indian grouping (12,34,567), no decimals ────────────

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const range: Range = (["today", "7d", "30d", "all"] as const).includes(
    params.range as Range
  )
    ? (params.range as Range)
    : "today";
  const window = rangeWindow(range);

  // Where clause: scoped to non-cancelled/returned orders inside the window.
  // Mutable arrays only — Prisma's generated types reject `as const` readonly
  // tuples on `notIn`.
  const orderWhere: {
    status: { notIn: ("CANCELLED" | "RETURNED")[] };
    createdAt?: { gte?: Date; lt?: Date };
  } = {
    status: { notIn: ["CANCELLED", "RETURNED"] },
    ...(window.gte || window.lt
      ? {
          createdAt: {
            ...(window.gte ? { gte: window.gte } : {}),
            ...(window.lt ? { lt: window.lt } : {}),
          },
        }
      : {}),
  };

  // Revenue/sales figures count only MONEY THAT'S ACTUALLY GOOD: POS bills are
  // always paid; online orders count once the gateway captured (PAID/PARTIAL)
  // OR staff confirmed the order into a billable status (Processing → Delivered,
  // e.g. a COD order). Only an online order still PENDING and unconfirmed is
  // excluded from every sales aggregate. Shared with the Orders page via
  // onlineNotASale() so both screens report the same numbers. (The recent-orders
  // list below still uses orderWhere, so pending orders remain visible there.)
  const revenueWhere = {
    ...orderWhere,
    NOT: onlineNotASale(),
  };

  // Exchanges/refunds processed inside the window (bucketed by when the exchange
  // was keyed, not the original order date). Their net price difference adjusts
  // Total Sales: a refund (customer owed → negative priceDifference) reduces
  // sales; a paid-up upgrade (positive) adds to it.
  const exchangeWhere =
    window.gte || window.lt
      ? {
          createdAt: {
            ...(window.gte ? { gte: window.gte } : {}),
            ...(window.lt ? { lt: window.lt } : {}),
          },
        }
      : {};

  // Run everything in parallel.
  const [
    totalProducts,
    totalProductsAll,
    totalVariants,
    outOfStockVariants,
    totalOrdersAllTime,
    lowStockVariants,
    recentOrders,
    // Revenue aggregations — split by source + payment method
    salesAgg,
    cashAgg,
    onlineAgg,
    posAgg,
    // Profit + COGS from order items in range
    orderItemsForProfit,
    // Stock value from current inventory snapshot
    activeProductsForStock,
    // Money actually received, split by tender method
    posTenderAgg,
    onlinePaidAgg,
    walletAgg,
    exchangeAgg,
  ] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count(),
    db.productVariant.count(),
    db.productVariant.count({ where: { stock: 0 } }),
    db.order.count(),
    db.productVariant.count({ where: { stock: { lte: 5 } } }),
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        salesman: { select: { name: true } },
      },
    }),
    db.order.aggregate({
      _sum: { total: true, subtotal: true, taxAmount: true },
      _count: true,
      where: revenueWhere,
    }),
    db.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { ...revenueWhere, paymentMethod: "CASH" },
    }),
    db.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { ...revenueWhere, source: "ONLINE" },
    }),
    db.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { ...revenueWhere, source: "POS" },
    }),
    // Pull just the fields we need for profit math; cap at 50k items to
    // protect the dashboard from a runaway query if the store grows big.
    db.orderItem.findMany({
      where: { order: revenueWhere },
      select: {
        quantity: true,
        unitPrice: true,
        totalPrice: true,
        costPriceSnapshot: true,
        taxPercent: true,
      },
      take: 50_000,
    }),
    // Stock-value snapshot of all currently-active products + their variants.
    // Pull cost, MRP and selling price so we can value stock three ways.
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        costPrice: true,
        mrp: true,
        sellingPrice: true,
        onlinePrice: true,
        taxSlab: { select: { percentage: true } },
        variants: { select: { stock: true } },
      },
    }),
    // POS split-tender received, by method (online orders don't carry these).
    db.order.aggregate({
      _sum: { paidCash: true, paidUpi: true, paidCard: true, paidCredit: true },
      where: { ...revenueWhere, source: "POS" },
    }),
    // Online money actually collected via the gateway (PAID/PARTIAL only) =
    // total − wallet credit − balance still owed (COD/partial).
    db.order.aggregate({
      _sum: { total: true, walletApplied: true, paidCredit: true },
      _count: true,
      where: { ...orderWhere, source: "ONLINE", paymentStatus: { in: ["PAID", "PARTIAL"] } },
    }),
    // Store-credit (wallet) redeemed across all orders.
    db.order.aggregate({ _sum: { walletApplied: true }, where: revenueWhere }),
    // Exchanges/refunds in the window — net price difference adjusts sales.
    db.exchange.aggregate({
      _sum: { priceDifference: true },
      _count: true,
      where: exchangeWhere,
    }),
  ]);

  // ── Derive stats ────────────────────────────────────────────────────────────
  // Net exchange/refund adjustment for the window (negative = net refunds out).
  const exchangeAdjustment = exchangeAgg._sum.priceDifference ?? 0;
  const exchangeCount = exchangeAgg._count ?? 0;
  // Total Sales is order revenue with refunds/exchanges netted out.
  const grossSales = salesAgg._sum.total ?? 0;
  const totalSales = grossSales + exchangeAdjustment;
  const totalOrders = salesAgg._count ?? 0;
  const taxCollected = salesAgg._sum.taxAmount ?? 0;
  const netRevenue = salesAgg._sum.subtotal ?? 0; // ex-GST

  const cashSales = cashAgg._sum.total ?? 0;
  const cashOrders = cashAgg._count ?? 0;
  const onlineSales = onlineAgg._sum.total ?? 0;
  const onlineOrders = onlineAgg._count ?? 0;
  const posSales = posAgg._sum.total ?? 0;
  const posOrders = posAgg._count ?? 0;

  // ── Money received, by payment method ───────────────────────────────────────
  const cashReceived = posTenderAgg._sum.paidCash ?? 0;
  const upiReceived = posTenderAgg._sum.paidUpi ?? 0;
  const cardReceived = posTenderAgg._sum.paidCard ?? 0;
  const creditOwed = posTenderAgg._sum.paidCredit ?? 0; // POS "khata" — owed, not received
  const walletRedeemed = walletAgg._sum.walletApplied ?? 0;
  // Actual gateway collection on PAID/PARTIAL online orders. This is the figure
  // to compare with PayU — NOT `onlineSales`, which is order value by source and
  // includes unpaid/PENDING online orders.
  const onlineCollected =
    (onlinePaidAgg._sum.total ?? 0) -
    (onlinePaidAgg._sum.walletApplied ?? 0) -
    (onlinePaidAgg._sum.paidCredit ?? 0);
  const onlinePaidOrders = onlinePaidAgg._count ?? 0;

  // Inventory sales = items with a real variantId (excludes POS "cash items"
  // which carry variantId=null in OrderItem).
  let inventorySalesValue = 0;
  let cogs = 0; // COGS ex-GST (cost snapshots are stored pre-GST)
  let cogsIncGst = 0; // same COGS grossed up by each item's tax %
  let cogsCoveredItems = 0;
  let totalItemRows = 0;
  for (const it of orderItemsForProfit) {
    totalItemRows += 1;
    inventorySalesValue += it.totalPrice;
    if (it.costPriceSnapshot != null) {
      const lineCost = it.costPriceSnapshot * it.quantity;
      cogs += lineCost;
      cogsIncGst += lineCost * (1 + (it.taxPercent ?? 0) / 100);
      cogsCoveredItems += 1;
    }
  }
  // Profit math — the previous "before GST" figure subtracted an EX-GST COGS
  // from an INC-GST sales total (mixed bases), overstating profit by the input
  // GST. Both views now compare like with like:
  //   profitPreTax  = total (inc-GST sales)   − COGS (inc-GST)  → cash margin before remitting GST
  //   profitPostTax = subtotal (ex-GST sales) − COGS (ex-GST)   → true gross profit after the govt's slice
  // With no operating expenses tracked, post-GST gross profit IS the net profit
  // on goods, so Net Profit mirrors it (and drives the margin %).
  const profitPreTax = grossSales - cogsIncGst;
  const profitPostTax = netRevenue - cogs;
  const netProfit = profitPostTax;
  // Blended margin: net profit as a share of ex-GST sales.
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const cogsCoverage =
    totalItemRows === 0 ? 0 : Math.round((cogsCoveredItems / totalItemRows) * 100);

  // Stock-value snapshot on the current on-hand quantity:
  //   • Cost      — stock × costPrice (only where a cost is recorded → coverage %)
  //   • Cost-total— real value of ALL stock at cost: costPrice where set, else the
  //                 product's price (selling → online → MRP) so it's never zero
  //   • Selling   — stock × sellingPrice (falls back to onlinePrice, then MRP)
  // Cost also carries a GST-inclusive figure for the "what it's worth" view.
  let stockValueCost = 0;
  let stockValueCostGst = 0;
  let stockValueCostTotal = 0;
  let stockValueSelling = 0;
  let stockCoveredUnits = 0;
  let stockTotalUnits = 0;
  for (const p of activeProductsForStock) {
    const units = p.variants.reduce((s, v) => s + v.stock, 0);
    stockTotalUnits += units;
    const taxMult = 1 + (p.taxSlab?.percentage ?? 0) / 100;
    stockValueCostTotal += units * (p.costPrice ?? p.sellingPrice ?? p.onlinePrice ?? p.mrp ?? 0);
    stockValueSelling += units * (p.sellingPrice ?? p.onlinePrice ?? p.mrp ?? 0);
    if (p.costPrice != null) {
      stockCoveredUnits += units;
      stockValueCost += units * p.costPrice;
      stockValueCostGst += units * p.costPrice * taxMult;
    }
  }
  const stockCoverage =
    stockTotalUnits === 0 ? 0 : Math.round((stockCoveredUnits / stockTotalUnits) * 100);

  // ── Render ──────────────────────────────────────────────────────────────────
  // Drill-in links carry the currently-selected window so a click lands on the
  // matching filtered list. Reports is the fallback for figures without a
  // dedicated list view (tender splits, profit, stock valuation).
  const ordersHref = (extra?: string) =>
    `/admin/orders?range=${range}${extra ? `&${extra}` : ""}`;
  const reportsHref = `/admin/reports?range=${range}`;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif text-nate-grey-800">Dashboard</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            Showing stats for <strong>{window.label}</strong>
          </p>
        </div>
        <RangePicker current={range} />
      </div>

      {/* ── Money row — sales by source ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total Sales"
          value={inr(totalSales)}
          sublabel={
            exchangeAdjustment !== 0
              ? `${totalOrders} orders · ${inr(-exchangeAdjustment)} refunds adjusted (${exchangeCount})`
              : `${totalOrders} orders`
          }
          href={ordersHref()}
        />
        <StatCard
          icon={<Receipt className="w-5 h-5" />}
          label="POS Orders"
          value={inr(posSales)}
          sublabel={`${posOrders} orders`}
          href={ordersHref("source=POS")}
          tone="purple"
        />
        <StatCard
          icon={<ShoppingBag className="w-5 h-5" />}
          label="Online Orders"
          value={inr(onlineSales)}
          sublabel={`${onlineOrders} paid order${onlineOrders === 1 ? "" : "s"}`}
          href={ordersHref("source=ONLINE")}
          tone="blue"
        />
      </div>

      {/* ── Received by payment method ────────────────────────────────────── */}
      <p className="text-xs font-medium uppercase tracking-wide text-nate-grey-400 mb-2">
        Received by payment method
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={<Banknote className="w-5 h-5" />} label="Cash" value={inr(cashReceived)} tone="green" href={ordersHref("source=POS")} />
        <StatCard icon={<Smartphone className="w-5 h-5" />} label="UPI" value={inr(upiReceived)} href={ordersHref("source=POS")} />
        <StatCard icon={<CreditCard className="w-5 h-5" />} label="Card" value={inr(cardReceived)} href={ordersHref("source=POS")} />
        <StatCard
          icon={<Globe className="w-5 h-5" />}
          label="Online (gateway)"
          value={inr(onlineCollected)}
          sublabel={`${onlinePaidOrders} paid online`}
          tone="blue"
          href={ordersHref("source=ONLINE")}
        />
        <StatCard
          icon={<Landmark className="w-5 h-5" />}
          label="On credit (owed)"
          value={inr(creditOwed)}
          tone={creditOwed > 0 ? "red" : undefined}
          href={ordersHref("source=POS")}
        />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="Wallet redeemed" value={inr(walletRedeemed)} href={reportsHref} />
      </div>

      {/* ── Profit row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<CreditCard className="w-5 h-5" />}
          label="Profit (before GST remitted)"
          value={inr(profitPreTax)}
          sublabel={`Inc-GST basis · COGS ${inr(cogsIncGst)}`}
          href={reportsHref}
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5" />}
          label="Profit (after GST remitted)"
          value={inr(profitPostTax)}
          sublabel={`Net rev. ${inr(netRevenue)} · tax ${inr(taxCollected)}`}
          href={reportsHref}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Net Profit"
          value={inr(netProfit)}
          sublabel={`Ex-GST sales − COGS · coverage ${cogsCoverage}%`}
          tone={netProfit < 0 ? "red" : "green"}
          href={reportsHref}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Avg Profit Margin"
          value={`${profitMargin.toFixed(1)}%`}
          sublabel={`Net profit ÷ net revenue`}
          tone={profitMargin < 0 ? "red" : undefined}
          href={reportsHref}
        />
      </div>

      {/* ── Stock value row — valued three ways on current on-hand stock ───── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<Warehouse className="w-5 h-5" />}
          label="Stock Value @ Cost"
          value={inr(stockValueCost)}
          sublabel={
            stockCoverage < 100
              ? `Only ${stockCoverage}% of units have a cost price`
              : `incl. GST ${inr(stockValueCostGst)}`
          }
          tone={stockCoverage < 50 ? "red" : undefined}
          href="/admin/products"
        />
        <StatCard
          icon={<Warehouse className="w-5 h-5" />}
          label="Stock Value @ Cost Price"
          value={inr(stockValueCostTotal)}
          sublabel={
            stockCoverage < 100
              ? `${stockTotalUnits.toLocaleString("en-IN")} units · cost on ${stockCoverage}%, else price`
              : `${stockTotalUnits.toLocaleString("en-IN")} units at cost`
          }
          href="/admin/inventory"
        />
        <StatCard
          icon={<Warehouse className="w-5 h-5" />}
          label="Stock Value @ Selling Price"
          value={inr(stockValueSelling)}
          sublabel={`${stockTotalUnits.toLocaleString("en-IN")} units at selling price`}
          href="/admin/inventory"
        />
      </div>

      {/* ── Catalog snapshot row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Total Products"
          value={totalProductsAll.toString()}
          sublabel={`${totalProducts} active`}
          href="/admin/products"
        />
        <StatCard
          icon={<Boxes className="w-5 h-5" />}
          label="Total Variants"
          value={totalVariants.toString()}
          sublabel={`${stockTotalUnits.toLocaleString("en-IN")} units in stock`}
          href="/admin/inventory"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Low Stock"
          value={lowStockVariants.toString()}
          tone={lowStockVariants > 0 ? "red" : undefined}
          href="/admin/inventory"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Out of Stock"
          value={outOfStockVariants.toString()}
          tone={outOfStockVariants > 0 ? "red" : undefined}
          href="/admin/inventory"
        />
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Inventory Sales (range)"
          value={inr(inventorySalesValue)}
          sublabel="Excl. POS cash items"
          href={reportsHref}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="All-Time Orders"
          value={totalOrdersAllTime.toString()}
          href="/admin/orders?range=all"
        />
      </div>

      {/* Detailed reports link */}
      <div className="mb-8">
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-2 text-sm font-medium text-nate-grey-700 hover:text-nate-grey-900"
        >
          <BarChart3 className="w-4 h-4" /> Open detailed reports →
        </Link>
      </div>

      {/* Cost-coverage hint when most products lack costPrice */}
      {stockCoverage < 50 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-amber-900">
          <strong>Cost prices are missing on {100 - stockCoverage}% of stock.</strong>{" "}
          That&apos;s why <em>Stock Value @ Cost</em> and <em>Profit</em> look low — they can
          only count products that have a cost price. Use{" "}
          <em>Retail (MRP)</em> / <em>Selling Price</em> above for the true worth of stock, and
          add cost prices on{" "}
          <Link href="/admin/products" className="underline font-medium">
            Admin → Products
          </Link>{" "}
          to unlock accurate cost &amp; margin figures.
        </div>
      )}

      {/* ── Recent orders ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-nate-grey-800">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm text-nate-grey-500 hover:text-nate-grey-800"
          >
            View all →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-nate-grey-500 text-sm">No orders yet.</p>
        ) : (
          <div className="space-y-1">
            {recentOrders.map((order) => (
              <Link
                href={`/admin/orders/${order.id}`}
                key={order.id}
                className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-nate-grey-50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                      order.source === "POS"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {order.source}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-nate-grey-700 truncate">
                      {order.id.slice(0, 8).toUpperCase()}
                      <span className="text-nate-grey-400 font-normal ml-2">
                        {order.source === "POS"
                          ? order.salesman?.name || "POS"
                          : order.user?.name || order.user?.email || "Guest"}
                      </span>
                    </p>
                    <p className="text-xs text-nate-grey-500">
                      {new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-nate-grey-800">{inr(order.total)}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === "DELIVERED"
                        ? "bg-green-100 text-green-700"
                        : order.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-700"
                        : order.status === "CANCELLED"
                        ? "bg-red-100 text-red-700"
                        : "bg-nate-grey-100 text-nate-grey-600"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sublabel,
  href,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  href?: string;
  tone?: "green" | "blue" | "purple" | "red";
}) {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    red: "bg-red-50 text-red-600 ring-1 ring-red-200",
  };

  const inner = (
    <div className="block bg-white rounded-xl p-5 hover:shadow-sm transition-shadow h-full">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-nate-grey-500 font-medium leading-snug">
          {label}
        </p>
        {icon && (
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              tone ? toneClasses[tone] : "bg-nate-grey-100 text-nate-grey-600"
            }`}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className={`font-sans font-semibold text-2xl tabular-nums lining-nums tracking-tight ${
          tone === "red" ? "text-red-600" : "text-nate-grey-900"
        }`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-nate-grey-400 mt-1 truncate">{sublabel}</p>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RangePicker({ current }: { current: Range }) {
  const options: { value: Range; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "all", label: "All time" },
  ];

  return (
    <div className="inline-flex bg-white rounded-lg p-1 border border-nate-grey-200">
      {options.map((o) => (
        <Link
          key={o.value}
          href={`/admin?range=${o.value}`}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            current === o.value
              ? "bg-nate-grey-800 text-white"
              : "text-nate-grey-600 hover:bg-nate-grey-100"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

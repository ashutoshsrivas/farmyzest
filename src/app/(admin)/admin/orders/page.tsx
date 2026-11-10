import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { Package } from "lucide-react";
import { OrdersFilters } from "./_components/OrdersFilters";
import { OrdersSummary } from "./_components/OrdersSummary";
import AdminPagination from "@/components/admin/Pagination";
import { orderSearchOr } from "@/lib/order-search";
import { quickRangeWindow, isQuickRange, type QuickRange } from "@/lib/order-range";
import { onlineNotASale } from "@/lib/order-status";

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-orange-100 text-orange-700",
};

const SOURCE_BADGE: Record<string, string> = {
  ONLINE: "bg-nate-grey-200 text-nate-grey-700",
  POS: "bg-accent text-white",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    source?: string;
    page?: string;
    from?: string;
    to?: string;
    q?: string;
    range?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  // Period: a quick range (Today / 7d / 30d / All), DEFAULTING to Today. An
  // explicit from/to overrides the quick range (custom period). Both the orders
  // table and the sales summary use this window.
  const hasCustom = !!(params.from || params.to);
  const quickRange: QuickRange = isQuickRange(params.range) ? params.range : "today";

  const dateRange: { gte?: Date; lt?: Date } = {};
  let periodLabel: string;
  if (hasCustom) {
    // from/to are yyyy-mm-dd, treated as local midnight ↔ local end-of-day.
    if (params.from) {
      const d = new Date(params.from);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        dateRange.gte = d;
      }
    }
    if (params.to) {
      const d = new Date(params.to);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 1); // exclusive upper bound
        dateRange.lt = d;
      }
    }
    periodLabel = "";
  } else {
    const w = quickRangeWindow(quickRange);
    if (w.gte) dateRange.gte = w.gte;
    if (w.lt) dateRange.lt = w.lt;
    periodLabel = w.label;
  }

  // Free-text search across name / order id / phone / email (linked account +
  // the contact captured on the order). ANDed with the other filters.
  const searchOr = orderSearchOr(params.q ?? "");

  const where: Prisma.OrderWhereInput = {
    ...(params.status ? { status: params.status as Prisma.OrderWhereInput["status"] } : {}),
    ...(params.source ? { source: params.source as Prisma.OrderWhereInput["source"] } : {}),
    ...(dateRange.gte || dateRange.lt ? { createdAt: dateRange } : {}),
    ...(searchOr.length ? { OR: searchOr } : {}),
  };

  // Sales analytics keys off the DATE RANGE only — independent of the
  // source/status table filters — so the channel split is always a complete
  // picture of the period. Cancelled/returned orders are excluded from sales.
  const salesWhere: Prisma.OrderWhereInput = {
    status: { notIn: ["CANCELLED", "RETURNED"] },
    // A sale counts once money is collected OR staff has confirmed the order.
    // POS bills are always paid at the counter; online orders count when the
    // gateway captured (PAID/PARTIAL) OR the order was moved to a billable
    // status (Processing → Delivered) — e.g. a confirmed COD order. Only an
    // online order still PENDING and unconfirmed is an abandoned cart and is
    // excluded. Shared with the dashboard via onlineNotASale(). (The table
    // below still lists every order.)
    NOT: onlineNotASale(),
    ...(dateRange.gte || dateRange.lt ? { createdAt: dateRange } : {}),
  };

  const [orders, total, salesBySource] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        salesman: { select: { name: true } },
        items: true,
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({
      by: ["source"],
      where: salesWhere,
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const onlineSales = salesBySource.find((s) => s.source === "ONLINE")?._sum.total ?? 0;
  const onlineCount = salesBySource.find((s) => s.source === "ONLINE")?._count._all ?? 0;
  const posSales = salesBySource.find((s) => s.source === "POS")?._sum.total ?? 0;
  const posCount = salesBySource.find((s) => s.source === "POS")?._count._all ?? 0;
  const totalSales = onlineSales + posSales;
  const totalCount = onlineCount + posCount;
  const summary = {
    totalSales,
    totalCount,
    onlineSales,
    onlineCount,
    posSales,
    posCount,
    avgCart: totalCount > 0 ? totalSales / totalCount : 0,
  };

  // Human label for the analytics period.
  const fmtShort = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  let rangeLabel = periodLabel || "All time";
  if (periodLabel) {
    // quick range → use its label as-is (set above)
  } else if (dateRange.gte && dateRange.lt) {
    const end = new Date(dateRange.lt);
    end.setDate(end.getDate() - 1);
    rangeLabel = `${fmtShort(dateRange.gte)} – ${fmtShort(end)}`;
  } else if (dateRange.gte) {
    rangeLabel = `Since ${fmtShort(dateRange.gte)}`;
  } else if (dateRange.lt) {
    const end = new Date(dateRange.lt);
    end.setDate(end.getDate() - 1);
    rangeLabel = `Up to ${fmtShort(end)}`;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Orders</h1>
        <span className="text-sm text-nate-grey-500">{total} orders</span>
      </div>

      <OrdersSummary data={summary} rangeLabel={rangeLabel} />

      <OrdersFilters />

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nate-grey-100 bg-nate-grey-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Order ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Customer</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Source</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Total</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Date</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-nate-grey-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-nate-grey-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-nate-grey-700">
                    {order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      // The real customer: a linked account, else the contact
                      // captured on the order (POS / guest checkout). Phone is
                      // the identifier.
                      const name =
                        order.user?.name ||
                        order.billingName ||
                        (order.source === "POS" ? "Walk-in" : "Guest");
                      const phone = order.user?.phone || order.billingPhone || null;
                      const email = order.user?.email || null;
                      return (
                        <>
                          <p className="font-medium text-nate-grey-800">{name}</p>
                          <p className="text-xs text-nate-grey-600 font-mono">
                            {phone || (email ? email : "No phone")}
                          </p>
                          <p className="text-xs text-nate-grey-400">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                            {order.source === "POS" && order.salesman?.name
                              ? ` · by ${order.salesman.name}`
                              : ""}
                          </p>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${SOURCE_BADGE[order.source] || "bg-nate-grey-100 text-nate-grey-600"}`}>
                      {order.source === "POS" ? "POS" : "Online"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-nate-grey-100 text-nate-grey-600"}`}>
                      {order.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-nate-grey-800">
                    Rs.{order.total.toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-4 text-nate-grey-500">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-accent hover:text-nate-grey-600 text-xs font-medium flex items-center gap-1 justify-end"
                    >
                      <Package className="w-3 h-3" />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
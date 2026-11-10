import { db } from "./db";

// Commission a salesman has earned from valid POS orders.
//
// Base attribution: a bill's value is credited to whoever ATTENDED the customer
// (attendedBy) when set, otherwise the biller (salesman), at THAT person's
// commission rate.
//
// Article-wise override: any order LINE can carry its own salesmanId. That
// line's value is credited to the line's salesman (at their own rate) and is
// REMOVED from the bill salesman's base — so an article assigned to someone else
// never adds to the top salesman's commission. Everything reconciles to
// order.total: bill-earner base = order.total − Σ(reassigned line totals).
//   commission = Σ (attributed value × that earner's commissionRate / 100)

export interface SalesmanEarning {
  sales: number;
  commission: number;
  incentive: number;
  earned: number; // commission + incentive
  orders: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Optional [gte, lt) window on order.createdAt to scope earnings to a period. */
export interface EarningsWindow {
  gte?: Date;
  lt?: Date;
}

/** Earnings for every salesman, keyed by salesmanId (one pass). */
export async function earningsBySalesman(window?: EarningsWindow): Promise<Map<string, SalesmanEarning>> {
  const orders = await db.order.findMany({
    where: {
      source: "POS",
      salesmanId: { not: null },
      status: { notIn: ["CANCELLED", "RETURNED"] },
      ...(window?.gte || window?.lt
        ? { createdAt: { ...(window.gte ? { gte: window.gte } : {}), ...(window.lt ? { lt: window.lt } : {}) } }
        : {}),
    },
    select: {
      salesmanId: true,
      attendedById: true,
      total: true,
      salesman: { select: { commissionRate: true } },
      attendedBy: { select: { commissionRate: true } },
      items: { select: { totalPrice: true, salesmanId: true } },
    },
  });

  // Commission rates for every salesman referenced on a LINE (article-wise).
  const lineSalesmanIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.salesmanId).filter(Boolean))),
  ] as string[];
  const lineSalesmen = lineSalesmanIds.length
    ? await db.salesman.findMany({ where: { id: { in: lineSalesmanIds } }, select: { id: true, commissionRate: true } })
    : [];
  const rateOf = new Map(lineSalesmen.map((s) => [s.id, s.commissionRate]));

  // Accumulate attributed SALES and COMMISSION per salesman. Commission is
  // summed per-attribution because different earners have different rates.
  const acc = new Map<string, { sales: number; commission: number; orders: number }>();
  const add = (id: string, sales: number, rate: number, isOrder = false) => {
    const e = acc.get(id) ?? { sales: 0, commission: 0, orders: 0 };
    e.sales += sales;
    e.commission += sales * (rate / 100);
    if (isOrder) e.orders += 1;
    acc.set(id, e);
  };

  for (const o of orders) {
    const billEarnerId = o.attendedById ?? o.salesmanId!;
    const billRate = o.attendedById ? (o.attendedBy?.commissionRate ?? 0) : (o.salesman?.commissionRate ?? 0);

    // Reassigned lines → their own salesman at their own rate.
    let reassignedValue = 0;
    for (const it of o.items) {
      if (it.salesmanId && it.salesmanId !== billEarnerId) {
        add(it.salesmanId, it.totalPrice, rateOf.get(it.salesmanId) ?? 0);
        reassignedValue += it.totalPrice;
      }
    }
    // Bill earner keeps the rest of the bill value (order count credited here).
    add(billEarnerId, o.total - reassignedValue, billRate, true);
  }

  const out = new Map<string, SalesmanEarning>();
  for (const [id, e] of acc) {
    out.set(id, {
      sales: r2(e.sales),
      commission: r2(e.commission),
      incentive: 0,
      earned: r2(e.commission),
      orders: e.orders,
    });
  }
  return out;
}

/** Earnings for a single salesman. Pass a window to scope to a date range. */
export async function earningsForSalesman(salesmanId: string, window?: EarningsWindow): Promise<SalesmanEarning> {
  const all = await earningsBySalesman(window);
  return all.get(salesmanId) ?? { sales: 0, commission: 0, incentive: 0, earned: 0, orders: 0 };
}

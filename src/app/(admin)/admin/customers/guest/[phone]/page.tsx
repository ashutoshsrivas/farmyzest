export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Phone, Store, UserPlus, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/wallet";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-orange-100 text-orange-700",
};

const WALLET_TX_LABELS: Record<string, string> = {
  EXCHANGE_CREDIT: "Exchange credit",
  REFUND_CREDIT: "Refund credit",
  ADJUSTMENT: "Adjustment",
  ONLINE_REDEEM: "Used online",
  POS_REDEEM: "Used at store",
};

// Guest / POS customer detail — identified by phone, not an account. Shows the
// orders placed against that phone (no loyalty/account actions, since there's
// no User record). The list page links here for unregistered contacts.
export default async function GuestCustomerPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { phone: raw } = await params;
  const phone = decodeURIComponent(raw);
  const digits = phone.replace(/\D/g, "").slice(-10);

  // Match every order whose billingPhone normalises to the same last-10-digits,
  // regardless of how it was typed at the till — so a repeat customer's bills
  // all appear here even if an older one was saved in a different format.
  const matchIds = digits
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Order"
        WHERE "userId" IS NULL
          AND RIGHT(REGEXP_REPLACE("billingPhone", '[^0-9]', '', 'g'), 10) = ${digits}
      `
    : [];

  const orders = matchIds.length
    ? await db.order.findMany({
        where: { id: { in: matchIds.map((r) => r.id) } },
        orderBy: { createdAt: "desc" },
        include: { items: true, salesman: { select: { name: true } } },
        take: 100,
      })
    : [];

  if (orders.length === 0) notFound();

  // Store-credit wallet for this phone — read-only display.
  const walletPhone = normalizePhone(phone);
  const wallet =
    walletPhone.length === 10
      ? await db.wallet.findUnique({
          where: { phone: walletPhone },
          include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } },
        })
      : null;

  // Representative name = most recent non-empty billingName.
  const name = orders.find((o) => o.billingName?.trim())?.billingName?.trim() || "Guest";
  const spent = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "RETURNED")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to customers
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-nate-grey-800 flex items-center gap-2">
              {name}
              <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-nate-grey-100 text-nate-grey-600">
                Guest / POS
              </span>
            </h1>
            <p className="text-sm text-nate-grey-500 mt-1 inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {phone}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Orders</p>
          <p className="text-2xl font-serif text-nate-grey-900">{orders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Total spent</p>
          <p className="text-2xl font-serif text-nate-grey-900">
            ₹{spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 flex items-center">
          <p className="text-xs text-nate-grey-500 inline-flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5" /> Unregistered — no loyalty account
          </p>
        </div>
      </div>

      {/* Store credit (wallet) — read-only */}
      <div className="bg-white rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-nate-grey-100">
          <h2 className="text-base font-medium text-nate-grey-800 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Store credit (wallet)
          </h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Balance</p>
          <p className="text-2xl font-serif text-nate-grey-900">
            ₹{(wallet?.balance ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>
        {!wallet || wallet.transactions.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-nate-grey-500">
            {wallet ? "No transactions yet." : "No store credit yet."}
          </p>
        ) : (
          <div className="divide-y divide-nate-grey-100 border-t border-nate-grey-100">
            {wallet.transactions.map((t) => (
              <div
                key={t.id}
                className="px-6 py-3 flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <p className="text-nate-grey-700 truncate">
                    {t.description || WALLET_TX_LABELS[t.type] || t.type}
                  </p>
                  <p className="text-xs text-nate-grey-400">
                    {new Date(t.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`font-medium tabular-nums shrink-0 ml-3 ${
                    t.amount >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {t.amount >= 0 ? "+" : "−"}₹
                  {Math.abs(t.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
          <h2 className="text-base font-medium text-nate-grey-800">
            Order history ({orders.length})
          </h2>
          <span className="text-xs text-nate-grey-400 inline-flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" />
            Tip: have them register with this phone to unify into an account
          </span>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-nate-grey-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-nate-grey-50">
                <td className="px-6 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-mono text-xs text-nate-grey-700 hover:text-accent"
                  >
                    {o.posOrderNum ?? `#${o.id.slice(0, 8).toUpperCase()}`}
                  </Link>
                  <p className="text-xs text-nate-grey-400 mt-0.5">
                    {o.source === "POS" ? `POS · ${o.salesman?.name ?? "—"}` : "Online"} ·{" "}
                    {o.items.length} item{o.items.length === 1 ? "" : "s"}
                  </p>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      STATUS_COLORS[o.status] ?? "bg-nate-grey-100 text-nate-grey-600"
                    }`}
                  >
                    {o.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-6 py-3 text-right font-medium text-nate-grey-800">
                  ₹{o.total.toLocaleString("en-IN")}
                </td>
                <td className="px-6 py-3 text-right text-nate-grey-500">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

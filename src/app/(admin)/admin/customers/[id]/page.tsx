export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Mail, Phone, Package, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/wallet";
import { CustomerActions } from "@/components/admin/CustomerActions";

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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { id } = await params;

  const customer = await db.user.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
        take: 50,
      },
      loyaltyTxs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!customer || customer.role !== "CUSTOMER") notFound();

  // Store-credit wallet — keyed by linked userId, falling back to the account's
  // normalized phone (the POS keys wallets by phone only). Read-only display.
  const customerPhone = normalizePhone(customer.phone);
  const wallet = await db.wallet.findFirst({
    where: {
      OR: [
        { userId: customer.id },
        ...(customerPhone.length === 10 ? [{ phone: customerPhone }] : []),
      ],
    },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  const totalSpent = customer.orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "RETURNED")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div>
      {/* Header */}
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
              {customer.name}
              {!customer.isActive && (
                <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-red-100 text-red-700">
                  Inactive
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-nate-grey-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {customer.email}
              </span>
              {customer.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {customer.phone}
                </span>
              )}
              <span>
                Joined{" "}
                {new Date(customer.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Orders</p>
          <p className="text-2xl font-serif text-nate-grey-900">{customer.orders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Total spent</p>
          <p className="text-2xl font-serif text-nate-grey-900">
            ₹{totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5">
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide">Addresses</p>
          <p className="text-2xl font-serif text-nate-grey-900">{customer.addresses.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-base font-medium text-nate-grey-800">
                Order history ({customer.orders.length})
              </h2>
            </div>
            {customer.orders.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-nate-grey-500">
                No orders yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-nate-grey-100">
                  {customer.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-nate-grey-50">
                      <td className="px-6 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-xs text-nate-grey-700 hover:text-accent"
                        >
                          #{o.id.slice(0, 8).toUpperCase()}
                        </Link>
                        <p className="text-xs text-nate-grey-400 mt-0.5">
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
                      <td className="px-6 py-3 text-nate-grey-500 text-right">
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
            )}
          </div>

          {/* Loyalty history */}
          {customer.loyaltyTxs.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-nate-grey-100">
                <h2 className="text-base font-medium text-nate-grey-800">Loyalty history</h2>
              </div>
              <div className="divide-y divide-nate-grey-100">
                {customer.loyaltyTxs.map((t) => (
                  <div key={t.id} className="px-6 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-nate-grey-700">{t.description}</p>
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
                      className={`font-medium tabular-nums ${
                        t.points >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {t.points >= 0 ? "+" : ""}
                      {Math.round(t.points)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions + addresses */}
        <div className="space-y-6">
          <CustomerActions
            customerId={customer.id}
            initialPoints={customer.loyaltyPoints}
            initialActive={customer.isActive}
            initialWalletBalance={wallet?.balance ?? 0}
            walletEligible={customerPhone.length >= 10}
          />

          {/* Store credit (wallet) — read-only */}
          <div className="bg-white rounded-xl overflow-hidden">
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
                      {Math.abs(t.amount).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-nate-grey-100">
              <h2 className="text-base font-medium text-nate-grey-800 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Addresses ({customer.addresses.length})
              </h2>
            </div>
            {customer.addresses.length === 0 ? (
              <p className="px-6 py-6 text-sm text-nate-grey-500">No saved addresses.</p>
            ) : (
              <div className="divide-y divide-nate-grey-100">
                {customer.addresses.map((a) => (
                  <div key={a.id} className="px-6 py-4 text-sm">
                    <p className="font-medium text-nate-grey-800 flex items-center gap-2">
                      {a.name}
                      {a.isDefault && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-nate-grey-100 text-nate-grey-600">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="text-nate-grey-500">{a.phone}</p>
                    <p className="text-nate-grey-600 mt-1">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                    </p>
                    <p className="text-nate-grey-500">
                      {[a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletForUser, normalizePhone } from "@/lib/wallet";
import { Wallet, StickyNote } from "lucide-react";

// The account layout (../layout.tsx) provides the sidebar, page background,
// and max-width container. This page renders only the main-content column.
//
// Defense-in-depth: keep our own auth() check so a future refactor that drops
// the layout doesn't silently expose wallet data (mirrors the sibling pages).

const WALLET_TX_LABELS: Record<string, string> = {
  EXCHANGE_CREDIT: "Exchange credit",
  REFUND_CREDIT: "Refund credit",
  ADJUSTMENT: "Adjustment",
  ONLINE_REDEEM: "Used online",
  POS_REDEEM: "Used at store",
};

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const wallet = await getWalletForUser(session.user.id);
  const transactions = wallet
    ? await db.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const balance = wallet?.balance ?? 0;

  // Credit notes the store has issued to this customer, matched by phone (the
  // same normalized-phone key the wallet uses). Read-only here.
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  const phoneNorm = normalizePhone(me?.phone);
  const creditNotes =
    phoneNorm.length === 10
      ? await db.creditNote.findMany({
          where: { phoneNormalized: phoneNorm, redeemedAt: null },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const creditNotesTotal = creditNotes.reduce((s, n) => s + n.amount, 0);

  return (
    <>
      {/* Wrappers (bg, container, sidebar) live in (store)/account/layout.tsx. */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-nate-grey-800">Store Credit</h1>
          <p className="text-nate-grey-500 mt-1 text-sm">
            Use your balance at checkout, online or in store
          </p>
        </div>
        <Link
          href="/account"
          className="text-sm text-nate-grey-500 hover:text-accent transition-colors"
        >
          ← Back to Account
        </Link>
      </div>

      {/* Balance card */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-nate-grey-500 uppercase tracking-wide font-medium mb-1">
              Wallet Balance
            </p>
            <p className="text-3xl font-serif text-nate-grey-800">
              ₹{balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-nate-grey-400 mt-1">
              {balance > 0
                ? "Available to spend on your next order"
                : "Earned from exchanges and refunds"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      {/* Credit notes issued by the store (matched by phone) */}
      {creditNotes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-nate-grey-100 flex items-center justify-between">
            <h2 className="text-lg font-serif text-nate-grey-800 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-nate-grey-500" />
              Credit Notes
            </h2>
            <span className="text-sm text-nate-grey-500">
              Total{" "}
              <span className="font-semibold text-nate-grey-800">
                ₹{creditNotesTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
          <div className="divide-y divide-nate-grey-100">
            {creditNotes.map((n) => (
              <div key={n.id} className="px-6 py-4 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="text-nate-grey-700 truncate">{n.note || "Credit note"}</p>
                  <p className="text-xs text-nate-grey-400 mt-0.5">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="font-medium tabular-nums text-green-700 shrink-0 ml-3">
                  +₹{n.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
          <p className="px-6 py-3 text-xs text-nate-grey-400 border-t border-nate-grey-100">
            Please visit the store or contact us to redeem a credit note.
          </p>
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-nate-grey-100">
          <h2 className="text-lg font-serif text-nate-grey-800">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-nate-grey-400">
            No transactions yet.
          </p>
        ) : (
          <div className="divide-y divide-nate-grey-100">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="px-6 py-4 flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <p className="text-nate-grey-700 truncate">
                    {t.description || WALLET_TX_LABELS[t.type] || t.type}
                  </p>
                  <p className="text-xs text-nate-grey-400 mt-0.5">
                    {new Date(t.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span
                    className={`font-medium tabular-nums ${
                      t.amount >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {t.amount >= 0 ? "+" : "−"}₹
                    {Math.abs(t.amount).toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <p className="text-xs text-nate-grey-400 mt-0.5">
                    Bal ₹
                    {t.balanceAfter.toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWalletForUser } from "@/lib/wallet";
import { db } from "@/lib/db";

// GET /api/wallet/me
// The logged-in customer's own store-credit balance + recent transactions.
// Resolves the wallet by the userId link first, then by the account phone.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = await getWalletForUser(session.user.id);
  if (!wallet) {
    return NextResponse.json({ balance: 0, transactions: [] });
  }

  const transactions = await db.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amount: true,
      balanceAfter: true,
      type: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ balance: wallet.balance, transactions });
}

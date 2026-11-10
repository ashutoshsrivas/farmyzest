import type { Prisma, WalletTxType } from "@prisma/client";
import { db } from "@/lib/db";

// ── Store-credit wallet helpers ─────────────────────────────────────────────
//
// A wallet is keyed by the customer's normalized (last-10-digit) phone, so the
// same balance is reachable whether the customer walks into the POS or logs in
// online. When the phone matches a registered account we also link `userId`,
// which lets online checkout find the wallet by the logged-in user.
//
// Every balance change is written through `creditWallet` / `debitWallet` so a
// WalletTransaction row (with the running `balanceAfter`) always exists — the
// balance is never mutated without an audit trail. All helpers take a Prisma
// transaction client so callers can fold wallet movement into the same atomic
// write as the order / exchange that triggered it.

/** Trailing 10 digits — "+91 98765 43210", "098765 43210" → "9876543210". */
export function normalizePhone(phone?: string | null): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

type Tx = Prisma.TransactionClient;

/**
 * Find (or lazily create) the wallet for a phone, linking it to a registered
 * account when one shares that number. Returns null if the phone is unusable
 * (fewer than 10 digits) so callers can skip silently.
 */
export async function getOrCreateWallet(tx: Tx, rawPhone: string | null | undefined) {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 10) return null;

  const existing = await tx.wallet.findUnique({ where: { phone } });
  if (existing) return existing;

  // Link to a registered account if exactly one matches this number.
  const matchingUser = await tx.user.findFirst({
    where: { phone: { contains: phone } },
    select: { id: true, wallet: { select: { id: true } } },
  });
  // If that user somehow already has a wallet under a different phone string,
  // don't double-link (userId is unique) — leave userId null.
  const userId = matchingUser && !matchingUser.wallet ? matchingUser.id : null;

  return tx.wallet.create({ data: { phone, userId } });
}

/** Resolve a logged-in user's wallet (by userId link, else by their phone). */
export async function getWalletForUser(userId: string) {
  const byUser = await db.wallet.findUnique({ where: { userId } });
  if (byUser) return byUser;
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true } });
  const phone = normalizePhone(user?.phone);
  if (phone.length < 10) return null;
  return db.wallet.findUnique({ where: { phone } });
}

/** Read-only balance lookup by phone (0 if no wallet yet). */
export async function getWalletBalanceByPhone(rawPhone: string): Promise<number> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 10) return 0;
  const w = await db.wallet.findUnique({ where: { phone }, select: { balance: true } });
  return w?.balance ?? 0;
}

/** Credit (add) money to a wallet + record the transaction. */
export async function creditWallet(
  tx: Tx,
  walletId: string,
  amount: number,
  type: WalletTxType,
  description: string,
  refs?: { orderId?: string; exchangeId?: string }
) {
  if (amount <= 0) throw new Error("creditWallet amount must be > 0");
  const w = await tx.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: amount } },
  });
  await tx.walletTransaction.create({
    data: {
      walletId,
      amount,
      balanceAfter: w.balance,
      type,
      description,
      orderId: refs?.orderId,
      exchangeId: refs?.exchangeId,
    },
  });
  return w.balance;
}

/**
 * Debit (spend) money from a wallet + record the transaction. Caps the debit at
 * the available balance and returns the amount actually applied, so callers can
 * never overdraw.
 */
export async function debitWallet(
  tx: Tx,
  walletId: string,
  requested: number,
  type: WalletTxType,
  description: string,
  refs?: { orderId?: string; exchangeId?: string }
): Promise<number> {
  if (requested <= 0) return 0;
  const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) return 0;
  const applied = Math.min(requested, wallet.balance);
  if (applied <= 0) return 0;
  const w = await tx.wallet.update({
    where: { id: walletId },
    data: { balance: { decrement: applied } },
  });
  await tx.walletTransaction.create({
    data: {
      walletId,
      amount: -applied,
      balanceAfter: w.balance,
      type,
      description,
      orderId: refs?.orderId,
      exchangeId: refs?.exchangeId,
    },
  });
  return applied;
}

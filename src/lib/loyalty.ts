import { db } from "./db";
import type { Prisma } from "@prisma/client";

// Single source of truth for loyalty config + point math.
//
// Historically the earn/redeem code each called
// `loyaltyConfig.findFirst({ where: { isActive: true } })` directly. When no
// config row existed that returned null, and redemption then failed with
// "Loyalty redemption unavailable" while earning silently fell back to a magic
// default of 1 point/₹100 — points that ignored whether the program was even
// enabled. ensureLoyaltyConfig() guarantees exactly one row exists (creating an
// active default the first time) so both paths read the SAME, real config, and
// the admin's Enable toggle is always honoured.

export const LOYALTY_DEFAULTS = {
  pointsPer100Rupees: 1,
  rupeeValuePerPoint: 0.25,
  minRedeemAmount: 100,
  isActive: true,
};

type LoyaltyClient = Prisma.TransactionClient | typeof db;

export type LoyaltyConfigLike = {
  id: string;
  pointsPer100Rupees: number;
  rupeeValuePerPoint: number;
  minRedeemAmount: number;
  isActive: boolean;
};

/**
 * Return the singleton loyalty config, creating a default (enabled) row the
 * first time. Pass a transaction client to participate in an order write.
 */
export async function ensureLoyaltyConfig(client: LoyaltyClient = db): Promise<LoyaltyConfigLike> {
  const existing = await client.loyaltyConfig.findFirst({ orderBy: { id: "asc" } });
  if (existing) return existing;
  return client.loyaltyConfig.create({ data: LOYALTY_DEFAULTS });
}

/**
 * Points earned on a spend of `amount` rupees. Returns 0 when the program is
 * disabled or the amount is non-positive. Whole points only (₹99 earns nothing
 * at 1/₹100), matching the pre-existing floor behaviour.
 */
export function pointsForAmount(
  amount: number,
  cfg: { pointsPer100Rupees: number; isActive: boolean }
): number {
  if (!cfg.isActive || amount <= 0) return 0;
  return Math.floor(amount / 100) * cfg.pointsPer100Rupees;
}

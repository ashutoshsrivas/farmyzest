import type { Prisma, PrismaClient } from "@prisma/client";

// Sequential, monotonic variant codes: SS-1, SS-2, SS-3 …
//
// Every product variant gets exactly one code, and the scannable barcode is
// the SAME string (CODE128 encodes "SS-1" fine). The number only ever goes
// UP — a deleted variant's code is retired forever and never reassigned, even
// if it was the highest one issued. That makes physical-stock tracking
// unambiguous: a label always maps to one variant for the life of the store.
//
// Why a counter row and not MAX(existing)+1: deleting the highest variant
// would let MAX-based numbering hand the same code to the next product. The
// counter is the single source of truth and is bumped with an atomic
// `increment`, so it's safe under concurrent product creates and never
// regresses on delete.

export const VARIANT_SKU_KEY = "variant_sku";
export const SKU_PREFIX = "SS";

/** Format a raw counter value as a variant code, e.g. 5 → "SS-5". */
export function formatVariantCode(n: number): string {
  return `${SKU_PREFIX}-${n}`;
}

// A Prisma transaction client (what you get inside db.$transaction). The
// allocator MUST run inside a transaction so the counter bump and the variant
// writes commit (or roll back) together.
type Tx = Prisma.TransactionClient;

/**
 * Atomically reserve `count` sequential variant codes and return them in
 * order. Must be called inside a `db.$transaction`. The reserved range is
 * `[value-count+1 … value]` after a single incrementing UPDATE, so two
 * concurrent callers can never receive overlapping codes.
 *
 * Self-seeds the counter row if the migration seed is somehow missing.
 */
export async function allocateVariantCodes(
  tx: Tx,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];

  // upsert keeps this safe even on a fresh DB where the seed row is absent.
  const counter = await tx.counter.upsert({
    where: { key: VARIANT_SKU_KEY },
    create: { key: VARIANT_SKU_KEY, value: count },
    update: { value: { increment: count } },
  });

  // After the bump, `counter.value` is the LAST number in our block.
  const end = counter.value;
  const start = end - count + 1;
  const codes: string[] = [];
  for (let n = start; n <= end; n++) codes.push(formatVariantCode(n));
  return codes;
}

/**
 * Convenience for callers that already hold a non-transactional client and
 * want a one-off allocation in its own transaction.
 */
export async function allocateVariantCodesStandalone(
  db: PrismaClient,
  count: number
): Promise<string[]> {
  return db.$transaction((tx) => allocateVariantCodes(tx, count));
}

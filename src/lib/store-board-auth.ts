import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Lightweight gate for the mobile /store-board area — a single shared login
// (read-only stock board), separate from the NextAuth admin/customer system.
// The credentials and signing secret live ONLY in server env, never in git.

export const STORE_BOARD_COOKIE = "ss_store_board";
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function secret(): string {
  return process.env.STORE_BOARD_SECRET || process.env.NEXTAUTH_SECRET || "store-board-insecure-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** A signed, expiring opaque token: "<expEpochMs>.<hmac>". */
export function issueToken(): string {
  const exp = String(Date.now() + TTL_SECONDS * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

/** Whether the configured email + password match (case-insensitive email). */
export function checkCredentials(email: string, password: string): boolean {
  const okEmail = (process.env.STORE_BOARD_EMAIL || "").trim().toLowerCase();
  const okPass = process.env.STORE_BOARD_PASSWORD || "";
  if (!okEmail || !okPass) return false; // not configured → never authenticate
  return email.trim().toLowerCase() === okEmail && password === okPass;
}

export const TTL = TTL_SECONDS;

/** Server-side: is the current request a signed-in store-board session? */
export async function isStoreBoardAuthed(): Promise<boolean> {
  const c = await cookies();
  return verifyToken(c.get(STORE_BOARD_COOKIE)?.value);
}

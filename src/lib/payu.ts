import crypto from "crypto";

// ── PayU hosted-checkout helper (server-only) ───────────────────────────────
//
// Online payments go through PayU's "Web SDK / hosted" form-POST flow:
//   1. We create the order (PENDING) and ask /api/payu/initiate for the signed
//      params, then auto-submit a form to PAYU_PAYMENT_URL.
//   2. The shopper pays on PayU (UPI / cards / netbanking).
//   3. PayU POSTs the result back to our surl/furl (a single /api/payu/callback
//      here), which we verify by re-hashing and then mark the order PAID/FAILED.
//
// The merchant KEY + SALT live ONLY in the server env (.env.production.local,
// gitignored) — never in the repo, never sent to the browser. The SALT is the
// shared secret that signs/verifies every request, so guard it like a password.

const MODE = (process.env.PAYU_MODE ?? "production").toLowerCase();

/** Live vs test PayU endpoint. Defaults to production. */
export const PAYU_PAYMENT_URL =
  MODE === "test" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment";

export function payuConfigured(): boolean {
  return !!(process.env.PAYU_KEY && process.env.PAYU_SALT);
}

function payuKey(): string {
  return process.env.PAYU_KEY ?? "";
}
function payuSalt(): string {
  return process.env.PAYU_SALT ?? "";
}

export interface PayuParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
}

/**
 * Build the signed params for the PayU payment form.
 *
 * Request hash sequence (the canonical PayU ordering — do not reorder):
 *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 * We don't use udf fields, so they're empty strings (the pipes still matter).
 * `amount` MUST be the exact string we send in the form (e.g. "1499.00").
 */
export function buildPaymentParams(input: {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
}): PayuParams {
  const key = payuKey();
  const salt = payuSalt();
  const { txnid, amount, productinfo, firstname, email, phone, surl, furl } = input;

  // Built as an explicit token list and join("|") so the pipe count can't drift:
  //   key,txnid,amount,productinfo,firstname,email, udf1..udf5 (5 empty),
  //   udf6..udf10 (5 empty), SALT  → the canonical 17-token PayU request hash.
  const tokens = [key, txnid, amount, productinfo, firstname, email, "", "", "", "", "", "", "", "", "", "", salt];
  const hash = crypto.createHash("sha512").update(tokens.join("|")).digest("hex");

  return { key, txnid, amount, productinfo, firstname, email, phone, surl, furl, hash };
}

/**
 * Verify the hash PayU POSTs back to surl/furl. Reverse sequence:
 *   sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * When PayU adds `additionalCharges`, it prefixes the string — handled below.
 * Returns true only if the recomputed hash matches the posted one.
 */
export function verifyResponseHash(p: Record<string, string>): boolean {
  const key = payuKey();
  const salt = payuSalt();
  const status = p.status ?? "";
  const txnid = p.txnid ?? "";
  const amount = p.amount ?? "";
  const productinfo = p.productinfo ?? "";
  const firstname = p.firstname ?? "";
  const email = p.email ?? "";
  const udf1 = p.udf1 ?? "";
  const udf2 = p.udf2 ?? "";
  const udf3 = p.udf3 ?? "";
  const udf4 = p.udf4 ?? "";
  const udf5 = p.udf5 ?? "";

  // Reverse token list (mirror of the request hash, with `status` inserted):
  //   SALT,status, udf10..udf6 (5 empty), udf5..udf1, email,firstname,
  //   productinfo,amount,txnid,key  → 18 tokens.
  const tokens = [
    salt, status, "", "", "", "", "",
    udf5, udf4, udf3, udf2, udf1,
    email, firstname, productinfo, amount, txnid, key,
  ];
  const base = tokens.join("|");
  const hashString = p.additionalCharges ? `${p.additionalCharges}|${base}` : base;
  const expected = crypto.createHash("sha512").update(hashString).digest("hex");

  const posted = (p.hash ?? "").toLowerCase();
  if (!posted || posted.length !== expected.length) return false;
  // Constant-time compare to avoid leaking via timing.
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(posted));
}

/** Absolute base URL PayU should redirect back to (must be the live https host). */
export function payuCallbackBase(): string {
  return (
    process.env.PAYU_CALLBACK_BASE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

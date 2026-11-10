import type { Prisma } from "@prisma/client";

// Free-text order search used by the admin Orders list + CSV export. Matches a
// (partial, case-insensitive) query against: order id / POS bill number,
// customer name, phone, and email — looking at BOTH the linked user account and
// the contact captured directly on the order (POS / guest checkout).
//
// Returns an array suitable for a Prisma `OR`. Empty when the query is blank.
export function orderSearchOr(raw: string): Prisma.OrderWhereInput[] {
  const q = raw.trim();
  if (!q) return [];
  const ci = { contains: q, mode: "insensitive" as const };

  const or: Prisma.OrderWhereInput[] = [
    { id: ci },                 // full or partial order id (shown as first 8 chars)
    { posOrderNum: ci },        // POS bill number
    { billingName: ci },
    { billingEmail: ci },
    { billingPhone: ci },
    { shippingName: ci },
    { shippingPhone: ci },
    { user: { is: { name: ci } } },
    { user: { is: { email: ci } } },
    { user: { is: { phone: ci } } },
  ];

  // Phone typed with spaces / dashes / brackets still matches a stored plain
  // number, e.g. "98765 43210" → "9876543210", "+91-98765" → "+9198765".
  const digits = q.replace(/[\s\-()]/g, "");
  if (digits && digits !== q) {
    const dci = { contains: digits, mode: "insensitive" as const };
    or.push(
      { billingPhone: dci },
      { shippingPhone: dci },
      { user: { is: { phone: dci } } },
    );
  }

  return or;
}

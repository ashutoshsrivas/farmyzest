export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CreditNotesClient } from "./_components/CreditNotesClient";

// Admin "Credit Notes" — a fully manual ledger of store credit / IOUs owed to
// customers. Name, phone and amount are all hand-entered (no order coupling).
export default async function CreditNotesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const rows = await db.creditNote.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const notes = rows.map((n) => ({
    id: n.id,
    name: n.name,
    phone: n.phone,
    amount: n.amount,
    note: n.note,
    createdAt: n.createdAt.toISOString(),
    redeemedAt: n.redeemedAt ? n.redeemedAt.toISOString() : null,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif text-nate-grey-800">Credit Notes</h1>
        <p className="text-sm text-nate-grey-500 mt-1">
          Manually record store credit owed to a customer — name, phone and amount.
        </p>
      </div>
      <CreditNotesClient notes={notes} />
    </div>
  );
}
